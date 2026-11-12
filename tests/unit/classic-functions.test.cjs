const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProxycheckProvider } = require('../../electron/features/proxy/proxycheck.cjs');
const { lookupProviders } = require('../../electron/features/proxy/providers.cjs');
const { assess } = require('../../electron/features/proxy/assessment.cjs');

test('IP trust uses the provider risk evidence, never latency or a fabricated default', async () => {
  let queried;
  const provider = createProxycheckProvider({
    fetchImpl: async (url) => {
      queried = url;
      return new Response(JSON.stringify({
        status: 'ok',
        '203.0.113.9': { proxy: 'yes', risk: 80, type: 'VPN', asn: 'AS64500' }
      }), { status: 200 });
    }
  });
  const sources = await lookupProviders('203.0.113.9', [provider], new AbortController().signal);
  assert.ok(queried.startsWith('https://proxycheck.io/v2/203.0.113.9?'));
  assert.ok(!queried.includes('password'));
  assert.equal(sources[0].status, 'ok');
  assert.equal(sources[0].risk, 80);
  assert.equal(assess(sources).trustScore, 20);
  assert.equal(assess([{ status: 'not_configured' }]).trustScore, null);
  assert.equal(assess([{ status: 'ok', id: 'fixture', proxy: false, hosting: false }]).trustScore, null);
  assert.deepEqual(assess(sources, 5), assess(sources, 5000));
});
test('rate limits and invalid provider data never become a positive trust score', async () => {
  const limit = createProxycheckProvider({
    fetchImpl: async () => new Response('', { status: 429 })
  });
  const invalid = createProxycheckProvider({
    fetchImpl: async () => new Response('{}', { status: 200 })
  });
  const sources = await lookupProviders('203.0.113.9', [limit, invalid], new AbortController().signal);
  assert.deepEqual(sources.map((s) => s.status), ['rate_limited', 'unavailable']);
  assert.equal(assess(sources).trustScore, null);
});
test('foreign news catalogue has all five topics with distinct HTTPS sources', async () => {
  const { NEWS_TOPICS, NEWS_SOURCES, sourcesForTopic } = await import('../../shared/news-catalog.mjs');
  assert.equal(NEWS_TOPICS.length, 5);
  assert.ok(NEWS_SOURCES.length <= 30);
  assert.equal(new Set(NEWS_SOURCES.map((s) => s.id)).size, NEWS_SOURCES.length);
  for (const topic of NEWS_TOPICS) {
    assert.ok(sourcesForTopic(topic.id).length >= 4);
    for (const s of NEWS_SOURCES.filter((s) => s.topic === topic.id)) {
      const u = new URL(s.url);
      assert.equal(u.protocol, 'https:');
      assert.ok(!u.username && !u.password);
      assert.ok(!u.hostname.endsWith('.ru'));
    }
  }
});
