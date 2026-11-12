const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');
const { createNewsService } = require('../../electron/features/news/service.cjs');
const { fetchFeed, parseFeed } = require('../../electron/features/news/feeds.cjs');
const catalog = ['fashion', 'ai'].map((topic) => ({
  id: topic,
  name: topic,
  topic,
  url: `https://example.com/${topic}`
}));
const xml = (topic) =>
  `<rss><channel>${Array.from({ length: 24 }, (_, i) => `<item><guid>${topic}-${i}</guid><title>${topic} ${i}</title><link>https://example.com/${topic}/${i}?utm_source=rss</link></item>`).join('')}</channel></rss>`;
async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-topics-'));
  const store = await openStore(dir);
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  updateSettings(store, { newsEnabled: true, newsTopic: 'fashion' });
  return store;
}
test('only the selected topic downloads; switching cannot return the old request and returning coalesces', async (t) => {
  const store = await setup(t),
    calls = [],
    release = {};
  const service = createNewsService({
    store,
    catalog,
    fetcher: async (url) => {
      const topic = url.split('/').pop();
      calls.push(topic);
      await new Promise((r) => (release[topic] = r));
      return xml(topic);
    }
  });
  t.after(() => service.close());
  const a = service.refreshNews({ topic: 'fashion' });
  await new Promise((r) => setImmediate(r));
  const b = service.refreshNews({ topic: 'ai' });
  await new Promise((r) => setImmediate(r));
  const a2 = service.refreshNews({ topic: 'fashion' });
  assert.deepEqual(calls, ['fashion', 'ai']);
  release.ai();
  const ai = await b;
  assert.equal(ai.topic, 'ai');
  assert.equal(ai.items.length, 24);
  assert.ok(ai.items.every((x) => x.topic === 'ai'));
  release.fashion();
  const fashion = await a;
  await a2;
  assert.equal(fashion.topic, 'fashion');
  assert.equal(fashion.items.length, 24);
  await service.refreshNews({ topic: 'fashion', force: true });
  assert.equal(calls.length, 2, 'rapid refresh must be throttled');
  service.configure();
  assert.equal(calls.length, 2, 'settings changes do not preload other topics');
});
test('empty/429 responses keep the last good topic and normalized duplicate URLs merge', async (t) => {
  const store = await setup(t);
  let mode = 'ok';
  const service = createNewsService({
    store,
    catalog,
    minRefreshMs: 0,
    fetcher: async () => {
      if (mode === '429') throw Error('RATE_LIMITED');
      return mode === 'empty' ? '<rss><channel/></rss>' : xml('fashion');
    }
  });
  t.after(() => service.close());
  assert.equal((await service.refreshNews({ topic: 'fashion' })).items.length, 24);
  for (mode of ['empty', '429']) {
    const result = await service.refreshNews({ topic: 'fashion', force: true });
    assert.equal(result.items.length, 24);
    assert.equal(result.sourceStates.fashion.stale, true);
  }
  const items = parseFeed(
    '<rss><channel><item><title>A</title><link>https://example.com/a?utm_source=x&amp;b=2&amp;a=1#x</link></item><item><title>A</title><link>https://example.com/a?a=1&amp;b=2</link></item></channel></rss>',
    catalog[0]
  );
  assert.equal(items.length, 1);
});
test('redirects cannot reach private addresses; XML declared encoding is respected', async () => {
  await assert.rejects(
    fetchFeed('https://example.com/rss', new AbortController().signal, {
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/feed' } })
    }),
    /REQUEST_BLOCKED/
  );
  const body = Buffer.from(
    '<?xml version="1.0" encoding="ISO-8859-1"?><rss><channel><item><title>Caf\xe9</title><link>https://example.com/cafe</link></item></channel></rss>',
    'latin1'
  );
  const feed = await fetchFeed('https://example.com/feed', new AbortController().signal, {
    fetchImpl: async () => new Response(body)
  });
  assert.equal(parseFeed(feed, catalog[0])[0].title, 'Café');
});
