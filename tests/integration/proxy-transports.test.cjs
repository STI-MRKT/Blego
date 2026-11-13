const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixtures } = require('../fixtures/proxy.cjs');
const { checkProxy } = require('../../electron/features/proxy/service.cjs');
for (const auth of [false, true])
  test(`controlled HTTPS via HTTP/HTTPS/SOCKS5 auth=${auth}`, async (t) => {
    const f = await fixtures(t, { auth });
    for (const value of f.proxies) {
      const r = await checkProxy({ value }, null, {
        target: f.target,
        ca: f.ca,
        resolveEndpoint: async (host) => host
      });
      assert.equal(r.connection, 'ok');
      assert.equal(r.exitIp, '203.0.113.1');
      assert.equal(r.assessment.score, null);
      assert.ok(r.timings.ipRequestMs >= 0);
    }
    assert.equal(f.remoteDns(), false);
  });
for (const status of [503, 429])
  test(`HTTP ${status} with success body is not success`, async (t) => {
    const f = await fixtures(t, { status, body: '{"ip":"203.0.113.1","success":true}' });
    const r = await checkProxy({ value: f.proxies[0] }, null, {
      target: f.target,
      ca: f.ca,
      resolveEndpoint: async (host) => host
    });
    assert.equal(r.connection, 'failed');
    assert.equal(r.exitIp, null);
  });
test('invalid JSON and cancellation are honest failures', async (t) => {
  const f = await fixtures(t, { body: 'not json' });
  assert.equal(
    (
      await checkProxy({ value: f.proxies[0] }, null, {
        target: f.target,
        ca: f.ca,
        resolveEndpoint: async (host) => host
      })
    ).connection,
    'failed'
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    checkProxy({ value: f.proxies[0] }, c.signal, {
      target: f.target,
      ca: f.ca,
      resolveEndpoint: async (host) => host
    }),
    /CANCELLED/
  );
});
test('reputation wait never changes transport timing or assessment', async () => {
  const ipLookup = async () => ({
    ip: '203.0.113.1',
    timings: { connectionMs: 2, ipRequestMs: 7 }
  });
  const providers = [{ id: 'fixture', lookup: async () => ({ proxy: true, hosting: false }) }];
  const a = await checkProxy({ value: '', reputation: true }, null, { ipLookup, providers });
  const b = await checkProxy({ value: '', reputation: true }, null, {
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
  const r = await checkProxy({ value: '', reputation: true }, null, {
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
      ca: f.ca,
      resolveEndpoint: async (host) => host
    });
    assert.equal(r.connection, 'failed');
  }
});
test('SOCKS5h uses remote DNS, explicit speed goes through the selected route, and no API opt-in sends no reputation request', async (t) => {
  const f = await fixtures(t);
  let called = 0;
  const r = await checkProxy(
    { value: f.proxies[2].replace('socks5:', 'socks5h:'), fullTest: true },
    null,
    {
      target: f.target,
      speedTarget: f.target,
      ca: f.ca,
      resolveEndpoint: async (host) => host,
      providers: [
        {
          id: 'spy',
          lookup() {
            called++;
          }
        }
      ]
    }
  );
  assert.equal(r.connection, 'ok');
  assert.equal(f.remoteDns(), true);
  assert.ok(r.speed.bytes > 0);
  assert.equal(r.quality.attempts, 3);
  assert.equal(called, 0);
  assert.ok(r.timings.tcpMs >= 0);
});
test('local service addresses are blocked and credentials never appear in result', async () => {
  const r = await checkProxy({ value: 'http://user:synthetic-password@127.0.0.1:80' });
  assert.equal(r.code, 'REQUEST_BLOCKED');
  assert.equal(r.exitIp, null);
  assert.equal(r.assessment.score, null);
  assert.equal(JSON.stringify(r).includes('synthetic-password'), false);
});
