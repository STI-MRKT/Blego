const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');
const { createNewsService } = require('../../electron/features/news/service.cjs');
const sources = ['one', 'two'].map((id) => ({
  id,
  name: id,
  url: `https://example.com/${id}`,
  topic: 'tech'
}));
const xml = (id) =>
  `<rss><channel><item><guid>${id}</guid><title>Новость ${id}</title><link>https://example.com/${id}/article</link></item></channel></rss>`;
test('success → partial failure → total failure → reopen retains per-source cache', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  updateSettings(store, { newsEnabled: true, newsSources: sources });
  let failed = [];
  const news = createNewsService({
    store,
    fetcher: async (url) => {
      const id = url.split('/').pop();
      if (failed.includes(id)) throw Error('UNAVAILABLE');
      return xml(id);
    }
  });
  let s = await news.refreshNews();
  assert.equal(s.items.length, 2);
  failed = ['one'];
  s = await news.refreshNews({ force: true });
  assert.equal(s.items.length, 2);
  assert.equal(s.sourceStates.one.stale, true);
  failed = ['one', 'two'];
  s = await news.refreshNews({ force: true });
  assert.equal(s.items.length, 2);
  news.close();
  store.close();
  store = await openStore(root);
  const restored = createNewsService({ store });
  assert.equal(restored.snapshot().items.length, 2);
  restored.close();
});
test('disabled module makes no fetch, timer uses configured interval, disabling aborts', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let calls = 0,
    delay = null,
    cleared = false,
    signal;
  const news = createNewsService({
    store,
    fetcher: async (_url, s) => {
      calls++;
      signal = s;
      return xml('one');
    },
    setTimer: (_fn, ms) => {
      delay = ms;
      return 1;
    },
    clearTimer: () => {
      cleared = true;
    }
  });
  news.configure();
  await news.refreshNews();
  assert.equal(calls, 0);
  updateSettings(store, { newsEnabled: true, newsSources: [sources[0]], newsInterval: 15 });
  news.configure();
  assert.equal(delay, 900000);
  await news.refreshNews();
  assert.equal(calls, 1);
  updateSettings(store, { newsEnabled: false });
  news.configure();
  assert.equal(cleared, true);
  await news.refreshNews();
  assert.equal(calls, 1);
  news.close();
});
test('four-worker limit and cancellation prevent late cache writes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const many = Array.from({ length: 9 }, (_, i) => ({
    id: `s${i}`,
    name: `s${i}`,
    url: `https://example.com/${i}`
  }));
  updateSettings(store, { newsEnabled: true, newsSources: many });
  let concurrent = 0,
    max = 0;
  const news = createNewsService({
    store,
    fetcher: async () => {
      concurrent++;
      max = Math.max(max, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return xml('same');
    }
  });
  await news.refreshNews();
  assert.equal(max, 4);
  assert.equal(news.snapshot().items.length, 1);
  const pending = news.refreshNews({ force: true });
  news.cancel();
  await pending;
  assert.equal(news.snapshot().items.length, 1);
  news.close();
});
test('feed fetch enforces HTTP, byte and redirect limits', async () => {
  const { fetchFeed } = require('../../electron/features/news/feeds.cjs');
  const signal = new AbortController().signal;
  for (const response of [
    new Response('bad', { status: 503 }),
    new Response('x', { status: 429 }),
    new Response('x', { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } })
  ])
    await assert.rejects(
      fetchFeed('https://example.com/feed', signal, { fetchImpl: async () => response })
    );
  let count = 0;
  await assert.rejects(
    fetchFeed('https://example.com/feed', signal, {
      fetchImpl: async () => {
        count++;
        return new Response(null, { status: 302, headers: { location: '/again' } });
      }
    }),
    /REDIRECT_LIMIT/
  );
  assert.equal(count, 4);
});
