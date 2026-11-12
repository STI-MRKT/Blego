const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixtures } = require('../fixtures/proxy.cjs');
const { checkProxy } = require('../../electron/features/proxy/service.cjs');
const { parseProxy } = require('../../electron/features/proxy/transports.cjs');

test('SOCKS5 uses local DNS while SOCKS5h delegates DNS, with real auth and TLS', async (t) => {
  const f = await fixtures(t, { auth: true });
  const deps = { target: f.target, ca: f.ca, resolveEndpoint: async (host) => host };
  for (const [protocol, remote] of [
    ['socks5', false],
    ['socks5h', true]
  ]) {
    const value = f.proxies[2].replace('socks5:', protocol + ':');
    assert.equal(parseProxy(value).protocol, protocol + ':');
    const result = await checkProxy({ value }, null, deps);
    assert.equal(result.connection, 'ok');
    assert.equal(f.remoteDns(), remote);
    const bad = await checkProxy({ value: value.replace('user:pass@', 'user:wrong@') }, null, deps);
    assert.equal(bad.code, 'AUTH_FAILED');
  }
});
test('proxy errors distinguish HTTP auth and TLS without echoing credentials', async (t) => {
  const f = await fixtures(t, { auth: true });
  for (const value of f.proxies.slice(0, 2)) {
    const result = await checkProxy({ value: value.replace('user:pass@', 'user:wrong@') }, null, {
      target: f.target,
      ca: f.ca,
      resolveEndpoint: async (host) => host
    });
    assert.equal(result.code, 'AUTH_FAILED');
    assert.ok(!JSON.stringify(result).includes('wrong'));
  }
  const result = await checkProxy({ value: f.proxies[1] }, null, {
    target: f.target,
    resolveEndpoint: async (host) => host
  });
  assert.equal(result.code, 'TLS_FAILED');
});
test('user input cannot connect to local or service proxies; request cannot override dependencies', async () => {
  for (const host of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '[::1]', '[::ffff:127.0.0.1]']) {
    const r = await checkProxy({
      value: `http://${host}:8080`,
      target: 'https://localhost/',
      resolveEndpoint: 'bypass'
    });
    assert.equal(r.code, 'REQUEST_BLOCKED', host);
  }
});
test('timeout is distinct from explicit cancellation and does not report a successful check', async () => {
  const deps = {
    timeoutMs: 15,
    ipLookup: (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      )
  };
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.equal((await checkProxy({ value: '' }, null, deps)).code, 'TIMEOUT');
    const c = new AbortController();
    const pending = checkProxy({ value: '' }, c.signal, { ...deps, timeoutMs: 1000 });
    c.abort();
    await assert.rejects(pending, /CANCELLED/);
  } finally {
    clearInterval(keepAlive);
  }
});
