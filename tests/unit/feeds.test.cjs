const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed } = require('../../electron/features/news/feeds.cjs');
const source = { id: 'fixture', name: 'Fixture', url: 'https://example.com/feed', topic: 'tech' };
test('RSS/Atom Unicode, single-quoted namespace links and unknown dates', () => {
  const rss = parseFeed(
    '<rss><channel><item><title>Привет</title><link>https://example.com/a</link></item></channel></rss>',
    source
  );
  assert.equal(rss[0].title, 'Привет');
  assert.equal(rss[0].publishedAt, null);
  const atom = parseFeed(
    "<feed xmlns='http://www.w3.org/2005/Atom'><entry><title>科技</title><link rel='alternate' href='https://example.com/b'/><updated>bad</updated><summary>&lt;b&gt;Text&lt;/b&gt;</summary></entry></feed>",
    source
  );
  assert.equal(atom[0].link, 'https://example.com/b');
  assert.equal(atom[0].publishedAt, null);
  assert.equal(atom[0].description, 'Text');
});
test('external XML entities, malformed XML, oversized feeds reject', () => {
  for (const xml of [
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
    '<rss>',
    ' '.repeat(2 * 1024 * 1024 + 1)
  ])
    assert.throws(() => parseFeed(xml, source));
});
test('broad editorial feeds exclude unrelated and sponsored entries using explicit catalog policy', () => {
  const { NEWS_SOURCES } = require('../../shared/news-catalog.mjs');
  const source = NEWS_SOURCES.find((s) => s.id === 'vogue-us');
  const xml =
    '<rss><channel>' +
    [
      'A designer brings a new collection to the runway',
      'A guide to the best hotels in Rome',
      'Sponsored: buy a dress today'
    ]
      .map(
        (title, i) => `<item><title>${title}</title><link>https://example.com/${i}</link></item>`
      )
      .join('') +
    '</channel></rss>';
  assert.deepEqual(
    parseFeed(xml, source).map((i) => i.title),
    ['A designer brings a new collection to the runway']
  );
});
test('CDATA HTML entities become readable headlines and descriptions without markup', () => {
  const [item] = parseFeed(
    '<rss><channel><item><title><![CDATA[Designer&#8217;s &amp; brand&#160;news]]></title><link>https://example.com/a</link><description><![CDATA[&lt;b&gt;Hello&lt;/b&gt;]]></description></item></channel></rss>',
    source
  );
  assert.equal(item.title, 'Designer’s & brand news');
  assert.equal(item.description, 'Hello');
});
