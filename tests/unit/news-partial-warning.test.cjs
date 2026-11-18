const { test } = require('node:test');
const assert = require('node:assert/strict');

test('News hides partial-source availability warning but keeps saved articles and real errors', async () => {
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  const oldNews = state.news;
  const oldEnabled = state.settings.newsEnabled;
  try {
    state.settings.newsEnabled = true;
    state.news = {
      topic: 'tech',
      items: [
        {
          topic: 'tech',
          title: 'Synthetic saved article',
          link: 'https://example.test/tech/saved',
          source: 'Synthetic source',
          stale: true
        }
      ],
      loading: false,
      error: 'Some sources are unavailable. Saved articles remain available.',
      sourceStates: { sample: { stale: true } }
    };
    const partial = newsBlockHTML();
    assert.match(partial, /Synthetic saved article/);
    assert.match(partial, /Saved copy/);
    assert.doesNotMatch(partial, /Some sources are unavailable/);
    assert.doesNotMatch(partial, /class="banner warn"/);

    state.news.error = 'News sources did not respond. Try again later.';
    const failed = newsBlockHTML();
    assert.match(failed, /class="banner warn"/);
    assert.match(failed, /News sources did not respond/);
  } finally {
    state.news = oldNews;
    state.settings.newsEnabled = oldEnabled;
  }
});
