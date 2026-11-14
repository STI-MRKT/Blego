const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createFacebookService } = require('../../electron/features/facebook/service.cjs');
const { normalizeTarget } = require('../../electron/features/facebook/normalize.cjs');
const targets = [normalizeTarget('123'), normalizeTarget('456')];
const collect = async (iterator) => {
  const out = [];
  for await (const item of iterator) out.push(item);
  return out;
};
test('TZ9 DNS, timeout and TLS retain specific reasons; 100-target queue cancels honestly', async () => {
  for (const [code, reason] of [
    ['ENOTFOUND', 'FB_DNS_ERROR'],
    ['ETIMEDOUT', 'FB_TIMEOUT'],
    ['CERT_HAS_EXPIRED', 'FB_TLS_ERROR']
  ]) {
    const service = createFacebookService({
      transport: async () => {
        throw Object.assign(Error('DO_NOT_LOG_SYNTHETIC_SECRET'), { code });
      }
    });
    const [row] = await collect(service.check({ targets: [targets[0]], runId: 'diagnostic' }));
    assert.equal(row.status, 'NETWORK_ERROR');
    assert.equal(row.reasonCode, reason);
    assert.ok(!JSON.stringify(row).includes('DO_NOT_LOG'));
  }
  let now = 10000,
    calls = 0;
  const service = createFacebookService({
    clock: {
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      }
    },
    transport: async (url) => {
      calls++;
      return { url, status: 200, body: '<p>Unknown response</p>' };
    }
  });
  const list = Array.from({ length: 100 }, (_, i) => normalizeTarget(String(10000 + i)));
  const rows = [];
  for await (const row of service.check({ targets: list, runId: 'batch' })) {
    rows.push(row);
    if (rows.length === 1) service.cancel();
  }
  assert.equal(calls, 1);
  assert.equal(rows.length, 100);
  assert.ok(rows.slice(1).every((r) => r.status === 'CANCELLED' && !r.attempted));
  const before = now;
  now += 5000;
  const [retry] = await collect(service.check({ targets: [list[0]], runId: 'retry' }));
  assert.ok(Date.parse(retry.checkedAt) > before);
  assert.equal(calls, 2);
});
