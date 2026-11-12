const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixtures } = require('../fixtures/proxy.cjs');
const { checkProxy } = require('../../electron/features/proxy/service.cjs');
for (const auth of [false, true])
  test(`controlled HTTPS via HTTP/HTTPS/SOCKS5 auth=${auth}`, async (t) => {
    const f = await fixtures(t, { auth });
    for (const value of f.proxies) {
      const r = await checkProxy({ value }, null, { target: f.target, ca: f.ca });
      assert.equal(r.connection, 'ok');
      assert.equal(r.exitIp, '203.0.113.1');
      assert.equal(r.assessment.score, null);
      assert.ok(r.timings.ipRequestMs >= 0);
    }
    assert.equal(f.remoteDns(), true);
  });
for (const status of [503, 429])
  test(`HTTP ${status} with success body is not success`, async (t) => {
    const f = await fixtures(t, { status, body: '{"ip":"203.0.113.1","success":true}' });
    const r = await checkProxy({ value: f.proxies[0] }, null, { target: f.target, ca: f.ca });
    assert.equal(r.connection, 'failed');
    assert.equal(r.exitIp, null);
  });
test('invalid JSON and cancellation are honest failures', async (t) => {
  const f = await fixtures(t, { body: 'not json' });
  assert.equal(
    (await checkProxy({ value: f.proxies[0] }, null, { target: f.target, ca: f.ca })).connection,
    'failed'
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    checkProxy({ value: f.proxies[0] }, c.signal, { target: f.target, ca: f.ca }),
    /CANCELLED/
  );
});
test('reputation wait never changes transport timing or assessment', async () => {
  const ipLookup = async () => ({
    ip: '203.0.113.1',
    timings: { connectionMs: 2, ipRequestMs: 7 }
  });
  const providers = [{ id: 'fixture', lookup: async () => ({ proxy: true, hosting: false }) }];
  const a = await checkProxy({ value: '' }, null, { ipLookup, providers });
  const b = await checkProxy({ value: '' }, null, {
    ipLookup,
    providers: [
      {
        id: 'fixture',
        lookup: async () => {
          await new Promise((r) => setTimeout(r, 30));
          return { proxy: true, hosting: false };
        }
      }
    ]
  });
  assert.equal(a.timings.ipRequestMs, b.timings.ipRequestMs);
  assert.deepEqual(a.assessment, b.assessment);
});
test('unavailable and malformed reputation adapters cannot produce clean scores', async () => {
  const ipLookup = async () => ({
    ip: '203.0.113.1',
    timings: { connectionMs: 1, ipRequestMs: 2 }
  });
  const r = await checkProxy({ value: '' }, null, {
    ipLookup,
    providers: [
      {
        id: 'offline',
        lookup: async () => {
          throw Error('fixture');
        }
      },
      { id: 'invalid', lookup: async () => ({}) }
    ]
  });
  assert.equal(r.assessment.score, null);
  assert.deepEqual(
    r.sources.map((s) => s.status),
    ['unavailable', 'invalid_response']
  );
});
test('wrong proxy credentials fail for all controlled transports', async (t) => {
  const f = await fixtures(t, { auth: true });
  for (const value of f.proxies) {
    const r = await checkProxy({ value: value.replace('user:pass@', 'user:wrong@') }, null, {
      target: f.target,
      ca: f.ca
    });
    assert.equal(r.connection, 'failed');
  }
});
