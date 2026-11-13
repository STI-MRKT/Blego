const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProxycheckProvider } = require('../../electron/features/proxy/proxycheck.cjs');
const { assess, quality } = require('../../electron/features/proxy/assessment.cjs');
const ip = '1.1.1.1';
const payload = (risk = 33) => ({
  status: 'ok',
  [ip]: {
    detections: { risk, confidence: 100, hosting: true, proxy: false, anonymous: false },
    network: { asn: 'AS13335', provider: 'Cloudflare', type: 'Hosting' },
    last_updated: '2026-11-12T21:01:01Z'
  }
});
test('stable v3 parses detections.risk, never confidence, and requests only the verified IP', async () => {
  let url, init;
  const p = createProxycheckProvider({
    fetchImpl: async (u, o) => {
      url = u;
      init = o;
      return new Response(JSON.stringify(payload()));
    }
  });
  const r = await p.lookup(ip, new AbortController().signal);
  assert.match(url, /^https:\/\/proxycheck.io\/v3\/1.1.1.1/);
  assert.equal(new URL(url).searchParams.has('key'), false);
  assert.equal(init.redirect, 'error');
  assert.equal(r.risk, 33);
  assert.equal(r.confidence, 100);
  assert.equal(assess([{ id: p.id, status: 'ok', ...r }], ip).score, 67);
  assert.equal(assess([{ id: p.id, status: 'ok', ...r }], '8.8.8.8').score, null);
  for (const value of [null, undefined, '33', -1, 101]) {
    const x = createProxycheckProvider({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ...payload(),
            [ip]: { ...payload()[ip], detections: { ...payload()[ip].detections, risk: value } }
          })
        )
    });
    const a = await x.lookup(ip, new AbortController().signal);
    assert.equal(a.risk, null);
  }
});
test('v3 refuses mismatched IP, malformed/status errors; safely labels 401/403/429', async () => {
  for (const body of [
    'oops',
    JSON.stringify({ status: 'ok', '8.8.8.8': payload()[ip] }),
    JSON.stringify({ ...payload(), status: 'denied' })
  ]) {
    const p = createProxycheckProvider({ fetchImpl: async () => new Response(body) });
    await assert.rejects(p.lookup(ip, new AbortController().signal), /PROVIDER_INVALID_RESPONSE/);
  }
  for (const status of [401, 403, 429, 500]) {
    const p = createProxycheckProvider({
      fetchImpl: async () => new Response('secret body', { status })
    });
    await assert.rejects(
      p.lookup(ip, new AbortController().signal),
      (e) =>
        e.message ===
        {
          401: 'PROVIDER_AUTH',
          403: 'PROVIDER_DENIED',
          429: 'RATE_LIMITED',
          500: 'PROVIDER_HTTP_ERROR'
        }[status]
    );
  }
});
test('provider TTL, cancellation and errors cannot leak a key or invent stale trust', async () => {
  let now = 1000000,
    calls = 0;
  const key = '111111-222222-333333-444444';
  const p = createProxycheckProvider({
    clock: () => now,
    getKey: () => key,
    fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify(payload()));
    }
  });
  await p.lookup(ip, new AbortController().signal);
  await p.lookup(ip, new AbortController().signal);
  assert.equal(calls, 1);
  now += 600001;
  await p.lookup(ip, new AbortController().signal);
  assert.equal(calls, 2);
  const c = new AbortController();
  c.abort();
  await assert.rejects(p.lookup(ip, c.signal), /CANCELLED/);
  const bad = createProxycheckProvider({
    getKey: () => key,
    fetchImpl: async () => {
      throw Error('https://provider?key=' + key);
    }
  });
  await assert.rejects(
    bad.lookup(ip, new AbortController().signal),
    (e) => e.message === 'PROVIDER_UNAVAILABLE' && !e.message.includes(key)
  );
  const timeout = createProxycheckProvider({
    timeoutMs: 5,
    fetchImpl: () => new Promise(() => {})
  });
  const keep = setInterval(() => {}, 20);
  try {
    const { lookupProviders } = require('../../electron/features/proxy/providers.cjs');
    const result = await lookupProviders(ip, [timeout], new AbortController().signal);
    assert.equal(result[0].status, 'timeout');
  } finally {
    clearInterval(keep);
  }
});
test('local quality requires three actual attempts and separates loss, RTT and jitter from reputation', () => {
  assert.equal(quality([]).score, null);
  assert.equal(quality([{ ms: 20 }]).score, null);
  const result = quality([{ ms: 100 }, { ms: 120 }, { ms: 80 }]);
  assert.equal(result.successes, 3);
  assert.equal(result.meanMs, 100);
  assert.equal(result.jitterMs, 30);
  assert.equal(result.score, 97);
  assert.equal(quality([{ ms: null }, { ms: null }, { ms: null }]).score, null);
  assert.ok(quality([{ ms: 100 }, { ms: null }, { ms: 80 }]).score < result.score);
});
