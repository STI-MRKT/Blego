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
