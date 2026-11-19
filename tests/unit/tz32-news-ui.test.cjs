const { test } = require('node:test');
const assert = require('node:assert/strict');
test('TZ32 News page renders up to forty articles and identifies the ten-day window', async () => {
  const { state } = await import('../../src/js/state.js');
  const { newsBlockHTML } = await import('../../src/js/ui/news.js');
  const previous = state.news;
  const topic = 'tech';
  try {
    state.news = {
      items: Array.from({length:45},(_,i)=>({
        id:'item-'+i,title:'Technology story '+i,link:'https://example.test/'+i,
        source:'Synthetic source',topic,publishedAt:Date.parse('2026-11-18T12:00:00Z')
      })),
      counts:{tech:45},loading:false,error:'',updatedAt:Date.parse('2026-11-19T12:00:00Z'),
      topic,copiedLink:null
    };
    const html = newsBlockHTML();
    assert.equal((html.match(/<article class="news-item-card/g)||[]).length,40);
    assert.match(html,/Stories from the last 10 days/);
    assert.match(html,/Showing 40 stories/);
  } finally {
    state.news = previous;
  }
});
