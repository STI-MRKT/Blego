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

test('News shows up to 15 cards per topic and never pads sparse feeds', async () => {
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  const { NEWS_TOPICS } = await import('../../shared/news-catalog.mjs');
  state.settings.newsEnabled = true;

  for (const { id } of NEWS_TOPICS) {
    state.news = {
      topic: id,
      items: Array.from({ length: 24 }, (_, i) => ({
        id: `${id}-${i}`,
        topic: id,
        title: `Article ${i}`,
        link: `https://example.test/${id}/${i}`
      }))
    };
    const html = newsBlockHTML();
    assert.equal((html.match(/class="news-item-card"/g) || []).length, 15);
    assert.equal((html.match(/data-news-copy="title"/g) || []).length, 15);
    assert.equal((html.match(/data-news-copy="link"/g) || []).length, 15);
    assert.ok(html.includes('Showing 15 stories'));
    assert.ok(!html.includes('Article 15'));
  }

  state.news = {
    topic: 'tech',
    items: Array.from({ length: 9 }, (_, i) => ({
      id: `tech-${i}`,
      topic: 'tech',
      title: `Available article ${i}`,
      link: `https://example.test/tech/${i}`
    }))
  };
  const html = newsBlockHTML();
  assert.equal((html.match(/class="news-item-card"/g) || []).length, 9);
  assert.ok(html.includes('Fewer than 10 articles are currently available'));
});
