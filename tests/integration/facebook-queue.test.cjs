const { test } = require('node:test');
const assert = require('node:assert/strict');
test('queue is sequential, rate-limited, pauses at 429 and never overwrites owner notes', async () => {
  const { createFacebookService } = require('../../electron/features/facebook/service.cjs');
  const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');
  let time = 0;
  const starts = [];
  const values = new Map();
  const service = createFacebookService({
    store: { get: (key) => values.get(key), set: (key, value) => values.set(key, value) },
    clock: {
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      }
    },
    transport: async (url) => {
      starts.push(time);
      return { url, status: starts.length === 2 ? 429 : 200, body: '' };
    }
  });
  const { targets } = normalizeFacebookTargets('123\n456\n789');
  service.saveManualNote({
    targetKey: targets[0].canonicalUrl,
    status: 'blocked',
    comment: 'Synthetic owner report'
  });
  const results = [];
  for await (const result of service.check({ targets, runId: 'run1' })) results.push(result);
  assert.deepEqual(starts, [0, 2000]);
  assert.equal(results.length, 3);
  assert.equal(results[2].reasonCode, 'QUEUE_PAUSED');
  assert.ok(results.every((row) => row.banAssessment === 'unknown'));
  assert.equal(service.notes(targets[0].canonicalUrl)[0].status, 'blocked');
});
test('deadline and cancellation settle even when an injected transport ignores abort; old run cannot leak', async () => {
  const { fetchPublicProfile } = require('../../electron/features/facebook/transport.cjs');
  const { createFacebookService } = require('../../electron/features/facebook/service.cjs');
  const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');
  const deadline = new AbortController();
  let requestedDeadline;
  const request = fetchPublicProfile('https://www.facebook.com/alice', {
    deadline: (ms) => {
      requestedDeadline = ms;
      return deadline.signal;
    },
    request: async () => new Promise(() => {})
  });
  deadline.abort(Error('DEADLINE'));
  await assert.rejects(request, { message: 'DEADLINE' });
  assert.equal(requestedDeadline, 15000);
  const { targets } = normalizeFacebookTargets('alice\nbob');
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const service = createFacebookService({
    transport: async () => {
      entered();
      return new Promise(() => {});
    },
    clock: { now: () => 0, sleep: async () => {} }
  });
  const first = service.check({ targets, runId: 'old' });
  const pending = first.next();
  await started;
  const next = service.check({ targets: [], runId: 'new' });
  await next.next();
  assert.deepEqual(await pending, { done: true, value: undefined });
});
test('transport guards redirects, private addresses and decoded body size', async () => {
  const {
    fetchPublicProfile,
    isPublicAddress
  } = require('../../electron/features/facebook/transport.cjs');
  for (const address of [
    '127.0.0.1',
    '10.2.3.4',
    '192.168.1.2',
    '169.254.0.1',
    '::1',
    'fc00::1',
    '::ffff:127.0.0.1'
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  const dns = require('node:dns');
  const original = dns.lookup;
  try {
    dns.lookup = (_host, _options, callback) =>
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    await assert.rejects(fetchPublicProfile('https://www.facebook.com/alice'), {
      message: 'FB_PRIVATE_ADDRESS'
    });
  } finally {
    dns.lookup = original;
  }
  await assert.rejects(fetchPublicProfile('https://evil.test/a'), { message: 'FB_UNSAFE_URL' });
  await assert.rejects(
    fetchPublicProfile('https://www.facebook.com/a', {
      request: async () => ({ status: 302, headers: { location: 'https://evil.test/a' }, body: '' })
    }),
    { message: 'FB_UNSAFE_URL' }
  );
  await assert.rejects(
    fetchPublicProfile('https://www.facebook.com/a', {
      request: async () => ({ status: 302, headers: { location: '/b' }, body: '' })
    }),
    { message: 'FB_TOO_MANY_REDIRECTS' }
  );
  await assert.rejects(
    fetchPublicProfile('https://www.facebook.com/a', {
      request: async () => ({ status: 200, headers: {}, body: 'a'.repeat(2 * 1024 * 1024 + 1) })
    }),
    { message: 'FB_RESPONSE_TOO_LARGE' }
  );
});
