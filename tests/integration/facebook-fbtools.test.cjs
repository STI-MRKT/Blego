const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkFbTools, ENDPOINT } = require('../../electron/features/facebook/fbtools.cjs');
const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');

const FIRST = 'https://www.facebook.com/profile.php?id=4';
const SECOND = 'https://www.facebook.com/profile.php?id=999999999999999';

const event = (id, origin, name) => ({
  event: 'result',
  data: { id, origin, account: origin, status: { name, message: name } }
});
const response = (events, status = 200, contentType = 'application/x-ndjson') =>
  new Response(events.map((item) => JSON.stringify(item)).join('\n') + '\n', {
    status,
    headers: { 'content-type': contentType }
  });
const targets = (text = '4\n999999999999999') => normalizeFacebookTargets(text).targets;
async function collect(options) {
  const results = [];
  for await (const item of checkFbTools(options)) results.push(item);
  return results;
}

test('FB.Tools adapter sends one cookie-free bounded batch and maps valid/noexist', async () => {
  let called = 0;
  const rows = await collect({
    targets: targets(),
    runId: 'run-1',
    fetchImpl: async (url, init) => {
      called += 1;
      assert.equal(url, ENDPOINT);
      assert.equal(init.method, 'POST');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.accept, 'application/x-ndjson');
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.headers.Cookie, undefined);
      assert.deepEqual(JSON.parse(init.body), {
        inputData: [FIRST, SECOND],
        userLang: 'en',
        checkFriends: false
      });
      return response([
        { event: 'start', total: 2 },
        event(1, FIRST, 'valid'),
        event(2, SECOND, 'noexist'),
        { event: 'summary', info: { valid: 1, noExist: 1 } }
      ]);
    }
  });
  assert.equal(called, 1);
  assert.deepEqual(
    rows.map((row) => row.reasonCode),
    ['FBTOOLS_VALID', 'FBTOOLS_NOEXIST']
  );
  assert.equal(rows[0].source, 'fbtools');
  assert.equal(rows[0].availability, 'profile_visible');
  assert.equal(rows[1].availability, 'unavailable');
  assert.ok(rows.every((row) => row.banAssessment === 'unknown'));

  const { facebookPresentation } = await import('../../shared/facebook-presentation.mjs');
  assert.equal(facebookPresentation(rows[0]).status, 'LIVE');
  assert.equal(facebookPresentation(rows[1]).status, 'DIE');
});

test('FB.Tools invalid, verify and error never become DIE', async () => {
  const rows = await collect({
    targets: targets('4\n123\n456'),
    runId: 'invalid',
    fetchImpl: async () =>
      response([
        event(1, FIRST, 'invalid'),
        event(2, 'https://www.facebook.com/profile.php?id=123', 'verify'),
        event(3, 'https://www.facebook.com/profile.php?id=456', 'error')
      ])
  });
  const { facebookPresentation } = await import('../../shared/facebook-presentation.mjs');
  assert.deepEqual(
    rows.map((row) => facebookPresentation(row).status),
    ['UNKNOWN', 'UNKNOWN', 'UNKNOWN']
  );
});

test('FB.Tools does not trust a result associated with a mismatched origin', async () => {
  const rows = await collect({
    targets: targets('4'),
    runId: 'mismatch',
    fetchImpl: async () => response([event(1, SECOND, 'valid')])
  });
  assert.equal(rows[0].reasonCode, 'FBTOOLS_TARGET_MISMATCH');
  const { facebookPresentation } = await import('../../shared/facebook-presentation.mjs');
  assert.equal(facebookPresentation(rows[0]).status, 'UNKNOWN');
});

test('FB.Tools HTTP 429 is not interpreted as deletion; no automatic retries', async () => {
  let calls = 0;
  const rows = await collect({
    targets: targets(),
    runId: 'limited',
    fetchImpl: async () => {
      calls += 1;
      return response([{ event: 'error', message: 'Rate limited' }], 429);
    }
  });
  assert.equal(calls, 1);
  assert.ok(rows.every((row) => row.reasonCode === 'FBTOOLS_RATE_LIMITED'));
  assert.ok(rows.every((row) => row.availability === 'unknown'));
});

test('FB.Tools malformed or partial NDJSON preserves only matched completed rows', async () => {
  const rows = await collect({
    targets: targets(),
    runId: 'partial',
    fetchImpl: async () =>
      new Response(JSON.stringify(event(1, FIRST, 'valid')) + '\nthis is not json\n', {
        headers: { 'content-type': 'application/x-ndjson' }
      })
  });
  assert.deepEqual(
    rows.map((item) => item.reasonCode),
    ['FBTOOLS_VALID', 'FBTOOLS_INVALID_STREAM']
  );
});

test('FB.Tools unexpected content-type yields UNKNOWN for every item', async () => {
  const rows = await collect({
    targets: targets(),
    runId: 'format',
    fetchImpl: async () => response([event(1, FIRST, 'valid')], 200, 'text/html')
  });
  assert.ok(rows.every((row) => row.reasonCode === 'FBTOOLS_INVALID_FORMAT'));
});

test('FB.Tools unprocessed items become UNKNOWN and duplicate result IDs do not override first result', async () => {
  const rows = await collect({
    targets: targets(),
    runId: 'incomplete',
    fetchImpl: async () => response([event(1, FIRST, 'valid'), event(1, FIRST, 'noexist')])
  });
  assert.deepEqual(
    rows.map((item) => item.reasonCode),
    ['FBTOOLS_VALID', 'FBTOOLS_INCOMPLETE']
  );
});

test('FB.Tools cancellation produces CANCELLED without calling the provider', async () => {
  const controller = new AbortController();
  controller.abort();
  const rows = await collect({
    targets: targets(),
    runId: 'cancel',
    signal: controller.signal,
    fetchImpl: async (_url, init) => {
      assert.equal(init.signal.aborted, true);
      throw Error('aborted');
    }
  });
  assert.ok(rows.every((row) => row.reasonCode === 'CANCELLED'));
  assert.ok(rows.every((row) => row.checkedAt === null));
});

test('FB.Tools network failure remains UNKNOWN and never triggers the direct Facebook transport', async () => {
  const rows = await collect({
    targets: targets(),
    runId: 'network',
    fetchImpl: async () => {
      throw Error('offline');
    }
  });
  assert.ok(rows.every((row) => row.reasonCode === 'FBTOOLS_NETWORK_ERROR'));
  assert.ok(rows.every((row) => row.availability === 'unknown'));
});

test('FB.Tools refuses unsafe targets and oversized batches before making requests', async () => {
  await assert.rejects(
    collect({
      targets: [{ canonicalUrl: 'https://evil.invalid/4' }],
      runId: 'unsafe',
      fetchImpl: async () => {
        throw Error('must not be called');
      }
    }),
    /FB_INPUT_INVALID/
  );
  await assert.rejects(
    collect({ targets: Array.from({ length: 101 }, () => targets('4')[0]), runId: 'large' }),
    /FB_INPUT_INVALID/
  );
});

test('FB.Tools caps response size and does not report false DIE', async () => {
  const rows = await collect({
    targets: targets('4'),
    runId: 'huge',
    fetchImpl: async () =>
      new Response('x'.repeat(2 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'application/x-ndjson' }
      })
  });
  assert.equal(rows[0].reasonCode, 'FBTOOLS_RESPONSE_TOO_LARGE');
});

test('existing Facebook service dispatches opt-in FB.Tools provider while preserving default direct transport', async () => {
  const { createFacebookService } = require('../../electron/features/facebook/service.cjs');
  let fbCalls = 0;
  let directCalls = 0;
  const service = createFacebookService({
    transport: async (url) => {
      directCalls += 1;
      return { url, status: 200, headers: {}, body: '' };
    },
    fbtools: async function* ({ targets: items, runId }) {
      fbCalls += 1;
      for (const item of items) {
        yield {
          canonicalUrl: item.canonicalUrl,
          runId,
          source: 'fbtools',
          availability: 'unknown'
        };
      }
    },
    clock: { now: () => 20000, sleep: async () => {} }
  });
  const rows = targets('4');
  const external = [];
  for await (const row of service.check({ targets: rows, runId: 'provider', provider: 'fbtools' }))
    external.push(row);
  assert.equal(external.length, 1);
  assert.equal(fbCalls, 1);
  assert.equal(directCalls, 0);
  const direct = [];
  for await (const row of service.check({ targets: rows, runId: 'default' })) direct.push(row);
  assert.equal(directCalls, 1);
  assert.equal(direct.length, 1);
  await assert.rejects(async () => {
    for await (const row of service.check({ targets: rows, runId: 'bad', provider: 'arbitrary' }))
      void row;
  }, /FB_INPUT_INVALID/);
});
