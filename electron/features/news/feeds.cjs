const { XMLParser, XMLValidator } = require('fast-xml-parser');
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => ['item', 'entry', 'link'].includes(name)
});
const array = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const plain = (v) =>
  String(typeof v === 'object' ? v?.['#text'] || '' : v || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function normalizeLink(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}
function parseFeed(xml, source) {
  if (
    typeof xml !== 'string' ||
    Buffer.byteLength(xml) > 2 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw Error('INVALID_FEED');
  const doc = parser.parse(xml);
  if (!doc.rss?.channel && !doc.feed && !doc.RDF) throw Error('UNSUPPORTED_FEED');
  const entries = doc.rss?.channel?.item || doc.feed?.entry || doc.RDF?.item || [];
  const items = [],
    seen = new Set();
  for (const e of array(entries)) {
    const title = plain(e.title).slice(0, 300);
    const links = array(e.link);
    const candidate =
      links.find((l) => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate')) ||
      links[0];
    const link = normalizeLink(
      typeof candidate === 'object' ? candidate['@_href'] || candidate['#text'] : candidate
    );
    if (!title || !link) continue;
    const id = `${source.id}:${plain(e.guid || e.id) || link}`;
    if (seen.has(id) || seen.has(link)) continue;
    seen.add(id);
    seen.add(link);
    const date = Date.parse(plain(e.pubDate || e.published || e.updated || e.date));
    items.push({
      id,
      title,
      link,
      sourceId: source.id,
      source: source.name,
      topic: source.topic || '',
      publishedAt: Number.isFinite(date) ? date : null,
      description: plain(e.description || e.summary || e.content).slice(0, 2000)
    });
  }
  return items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)).slice(0, 500);
}
async function fetchFeed(url, signal, { fetchImpl = fetch } = {}) {
  const combined = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!normalizeLink(url)) throw Error('INVALID_SOURCE_URL');
    const response = await fetchImpl(url, {
      signal: combined,
      redirect: 'manual',
      headers: {
        accept: 'application/rss+xml, application/atom+xml, application/xml',
        'user-agent': 'BLEGO/1.1'
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      if (redirects === 3) throw Error('REDIRECT_LIMIT');
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR');
    }
    if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) {
      await response.body?.cancel();
      throw Error('FEED_TOO_LARGE');
    }
    const chunks = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) throw Error('FEED_TOO_LARGE');
        chunks.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    } catch {
      throw Error('INVALID_ENCODING');
    }
  }
  throw Error('REDIRECT_LIMIT');
}
module.exports = { parseFeed, fetchFeed, normalizeLink };
