const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('News renders exactly two escaped field copies per card without copying metadata or adding a header action', async () => {
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  state.news = {
    topic: 'fashion',
    items: [
      {
        id: 'one',
        topic: 'fashion',
        title: 'Full <b> & "quoted" title',
        link: 'https://example.test/story?a=1&b=two',
        source: 'Source only',
        author: 'Author only'
      }
    ]
  };
  state.settings.newsEnabled = true;
  const html = newsBlockHTML();
  assert.equal((html.match(/data-news-copy=/g) || []).length, 2);
  assert.ok(html.includes('data-copy="Full &lt;b&gt; &amp; &quot;quoted&quot; title"'));
  assert.ok(html.includes('data-copy="https://example.test/story?a=1&amp;b=two"'));
  assert.ok(!html.includes('data-copy="Source only"'));
  assert.ok(!html.includes('data-copy="Author only"'));
  assert.ok(!html.includes('data-copy-action="open"'));
});

test('News RSS and Atom retain the complete normalized headline beyond 300 characters for field copy', () => {
  const { parseFeed } = require('../../electron/features/news/feeds.cjs');
  const title = 'Fashion design '.repeat(30) + 'END_MARKER';
  const source = { id: 'qa', name: 'QA', topic: 'fashion' };
  for (const xml of [
    `<rss version="2.0"><channel><item><title>${title}</title><link>https://example.test/story</link></item></channel></rss>`,
    `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>${title}</title><link href="https://example.test/story" /></entry></feed>`
  ]) {
    assert.equal(parseFeed(xml, source, { relevance: false })[0].title, title);
  }
});
