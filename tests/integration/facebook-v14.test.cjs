const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createFacebookService } = require('../../electron/features/facebook/service.cjs');
const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');
const collect = async (iterable) => {
  const rows = [];
  for await (const r of iterable) rows.push(r);
  return rows;
};
test('Retry-After pauses queue and explicit retries across calls and persisted restart', async () => {
  let now = 1000,
    calls = 0;
  const values = new Map(),
    store = { get: (k) => values.get(k), set: (k, v) => values.set(k, v) };
  const options = {
    store,
    clock: {
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      }
    },
    transport: async (url) => {
      calls++;
      return { url, status: 429, headers: { 'retry-after': '120' }, body: '' };
    }
  };
  let service = createFacebookService(options);
  const { targets } = normalizeFacebookTargets('123\n456');
  const first = await collect(service.check({ targets, runId: 'one' }));
  assert.equal(calls, 1);
  assert.equal(first[0].status, 'RATE_LIMITED');
  assert.equal(first[1].attempted, false);
  assert.equal(first[0].retryAt, new Date(121000).toISOString());
  service = createFacebookService(options);
  const next = await collect(service.check({ targets: [targets[0]], runId: 'retry' }));
  assert.equal(calls, 1);
  assert.equal(next[0].status, 'RATE_LIMITED');
  now = 122000;
  await collect(service.check({ targets: [targets[0]], runId: 'later' }));
  assert.equal(calls, 2);
});
test('network diagnostics retain timing/source without secrets; cancel settles remaining rows', async () => {
  let calls = 0;
  const service = createFacebookService({
    clock: { now: () => 1000, sleep: async () => {} },
    transport: async () => {
      calls++;
      throw Object.assign(Error('FAKE_SECRET'), { code: 'ENOTFOUND' });
    }
  });
  const { targets } = normalizeFacebookTargets('123\n456');
  const rows = await collect(service.check({ targets, runId: 'network' }));
  assert.equal(calls, 2);
  assert.ok(
    rows.every(
      (r) =>
        r.status === 'NETWORK_ERROR' &&
        r.reasonCode === 'FB_DNS_ERROR' &&
        r.source === 'public_request' &&
        r.checkedAt
    )
  );
  assert.ok(!JSON.stringify(rows).includes('FAKE_SECRET'));
  const iterator = service.check({ targets, runId: 'cancel' });
  await iterator.next();
  service.cancel();
  assert.equal((await iterator.next()).value.status, 'CANCELLED');
});
test('explicitly linked local profile facts stay unverified and never flow to transport', async () => {
  const values = new Map(),
    requests = [];
  const service = createFacebookService({
    store: { get: (k) => values.get(k), set: (k, v) => values.set(k, v) },
    transport: async (url, options) => {
      requests.push({ url, keys: Object.keys(options) });
      return { url, status: 200, body: '' };
    }
  });
  service.linkImportedFacts({
    targetKey: '123',
    name: 'Synthetic Local Name',
    avatarUrl: 'https://example.test/avatar.jpg',
    recordId: '2'
  });
  assert.equal(service.importedFacts('123').verified, false);
  assert.throws(
    () => service.linkImportedFacts({ targetKey: '456', name: 'Bad', password: 'FAKE_PASSWORD' }),
    /FB_INPUT_INVALID/
  );
  const rows = await collect(
    service.check({ targets: normalizeFacebookTargets('123').targets, runId: 'local' })
  );
  assert.equal(rows[0].status, 'UNKNOWN');
  assert.equal(rows[0].profileName, null);
  assert.deepEqual(requests[0].keys, ['signal']);
  assert.ok(!JSON.stringify(requests).includes('Synthetic Local Name'));
});
