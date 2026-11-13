const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ06 Network renders independent numeric/unknown scales without removed controls or Russian chrome', async () => {
  const { state } = await import('../../src/js/state.js');
  const { networkHTML } = await import('../../src/js/ui/network.js');
  state.settings.proxyEnabled = true;
  state.network.proxy = {
    connection: 'ok',
    exitIp: '8.8.8.8',
    quality: { score: 65, successes: 3, attempts: 3, meanMs: 120 },
    assessment: { score: null },
    sources: []
  };
  const html = networkHTML();
  assert.ok(html.includes('Connection Quality'));
  assert.ok(html.includes('IP Trust'));
  assert.ok(html.includes('N/A'));
  assert.ok(
    !/net-ping|proxy-api-key|proxy-key-save|data-action="copy"|<details|[А-Яа-яЁё]/u.test(html)
  );
  assert.ok(html.includes('data-score="65"'));
  assert.ok(html.includes('data-score="unknown"'));
});
test('TZ06 News has article links but no copy buttons', async () => {
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  state.news = {
    topic: 'tech',
    items: [
      {
        topic: 'tech',
        title: 'Synthetic title',
        source: 'Synthetic source',
        link: 'https://example.test/article',
        publishedAt: '2026-01-01',
        author: 'Synthetic author'
      }
    ]
  };
  const html = newsBlockHTML();
  assert.ok(html.includes('https://example.test/article'));
  assert.ok(!/data-action="copy"|news-copy/.test(html));
});
