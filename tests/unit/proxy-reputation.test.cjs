const { test } = require('node:test');
const assert = require('node:assert/strict');
test('only numeric, IP-bound provider risk can produce Trust; missing and malformed values remain unknown', async () => {
  const { createProxycheckProvider } = require('../../electron/features/proxy/proxycheck.cjs');
  const { lookupProviders } = require('../../electron/features/proxy/providers.cjs');
  const { assess } = require('../../electron/features/proxy/assessment.cjs');
  for (const [risk, expected] of [
    [0, 100],
    [100, 0],
    [27, 73],
    ['', null],
    [false, null],
    [[], null],
    [null, null],
    [undefined, null],
    [-1, null],
    [101, null],
    ['0', null]
  ]) {
    const p = createProxycheckProvider({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ status: 'ok', '8.8.8.8': { proxy: 'no', risk, type: 'Business' } })
        )
    });
    const sources = await lookupProviders('8.8.8.8', [p], new AbortController().signal);
    assert.equal(assess(sources, '8.8.8.8').trustScore, expected, JSON.stringify(risk));
    assert.equal(assess(sources, '1.1.1.1').trustScore, null);
  }
  for (const [body, status] of [
    [{ status: 'ok', '1.1.1.1': { proxy: 'no', risk: 0 } }, 200],
    [{}, 429],
    [{}, 503]
  ]) {
    const p = createProxycheckProvider({
      fetchImpl: async () => new Response(JSON.stringify(body), { status })
    });
    assert.equal(
      assess(await lookupProviders('8.8.8.8', [p], new AbortController().signal), '8.8.8.8')
        .trustScore,
      null
    );
  }
});
test('a risk-only provider response does not fabricate negative VPN, hosting or Tor flags', async () => {
  const { createProxycheckProvider } = require('../../electron/features/proxy/proxycheck.cjs');
  const p = createProxycheckProvider({
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: 'ok', '8.8.8.8': { proxy: 'no', risk: 15 } }))
  });
  const r = await p.lookup('8.8.8.8', AbortSignal.timeout(1000));
  assert.equal(r.vpn, null);
  assert.equal(r.tor, null);
  assert.equal(r.hosting, null);
});
