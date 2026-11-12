const { test } = require('node:test');
const assert = require('node:assert/strict');
const { speedTest, latencySummary } = require('../../electron/server.cjs');
test('missing TCP samples stay missing and a single observation has no spread', () => {
  assert.deepEqual(latencySummary([null, null]), {
    best: null,
    worst: null,
    avg: null,
    jitter: null
  });
  assert.deepEqual(latencySummary([null, 12]), { best: 12, worst: 12, avg: 12, jitter: null });
  assert.deepEqual(latencySummary([10, null, 20, 30]), {
    best: 10,
    worst: 30,
    avg: 20,
    jitter: 20
  });
});
test('explicit speed download rejects oversize and cancellation instead of returning measurements', async () => {
  const response = () => new Response(new Uint8Array(10000001));
  await assert.rejects(speedTest({ fetchImpl: async () => response() }), /RESPONSE_TOO_LARGE/);
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    speedTest({
      signal: c.signal,
      fetchImpl: async () => {
        throw Error('MUST_NOT_FETCH');
      }
    }),
    (e) => e.name === 'AbortError'
  );
  const result = await speedTest({ fetchImpl: async () => new Response(new Uint8Array(8000)) });
  assert.equal(result.bytes, 8000);
  assert.ok(result.mbps >= 0);
  assert.equal(result.route, 'direct');
});
