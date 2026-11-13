const { relevantNews } = require('../../../shared/news-catalog.mjs');
const net = require('node:net');
const { isPublicAddress, resolvePublic } = require('../../local/network-safety.cjs');
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
    .replace(/&(?:#(x[0-9a-f]+|[0-9]+)|(amp|quot|apos|lt|gt|nbsp));/gi, (all, numeric, named) => {
      if (numeric) {
        const n =
          numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric);
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : '�';
      }
      return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[named.toLowerCase()];
    })
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function normalizeLink(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (
      (net.isIP(host) && !isPublicAddress(host)) ||
      host === 'localhost' ||
      /\.(?:localhost|local|internal)$/.test(host)
    )
      return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()])
      if (/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.href;
  } catch {
    return null;
  }
}
function parseFeed(xml, source, { relevance = true } = {}) {
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
    const description = plain(e.description || e.summary || e.content).slice(0, 2000);
    if (relevance && !relevantNews(source, title, description, link)) continue;
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
      author: plain(e.creator || e.author?.name || e.author).slice(0, 200),
      topic: source.topic || '',
      publishedAt: Number.isFinite(date) ? date : null,
      description
    });
  }
  return items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)).slice(0, 500);
}
async function fetchFeed(url, signal, { fetchImpl = publicFetch } = {}) {
  const combined = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!normalizeLink(url)) throw Error('REQUEST_BLOCKED');
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
      throw Error(
        response.status === 429
          ? 'RATE_LIMITED'
          : response.status === 403
            ? 'ACCESS_DENIED'
            : 'HTTP_ERROR'
      );
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
      const bytes = Buffer.concat(chunks);
      const declared = bytes
        .subarray(0, 256)
        .toString('ascii')
        .match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1];
      const httpEncoding = response.headers
        .get('content-type')
        ?.match(/charset=["']?([^;\s"']+)/i)?.[1];
      const encoding =
        bytes[0] === 255 && bytes[1] === 254
          ? 'utf-16le'
          : bytes[0] === 254 && bytes[1] === 255
            ? 'utf-16be'
            : httpEncoding || declared || 'utf-8';
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      throw Error('INVALID_ENCODING');
    }
  }
  throw Error('REDIRECT_LIMIT');
}

// Resolve and pin every redirect destination. Proxy environment is supplied by the host,
// never renderer input; CONNECT still targets the validated public IP.
async function publicFetch(raw, options) {
  const u = new URL(raw),
    host = u.hostname.replace(/^\[|\]$/g, '');
  const address = await require('../facebook/transport.cjs').withAbort(
    resolvePublic(host, options.signal),
    options.signal
  );
  options.signal.throwIfAborted();
  const transport = require(u.protocol === 'https:' ? 'node:https' : 'node:http');
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  const agent = proxy ? new (require('https-proxy-agent').HttpsProxyAgent)(proxy) : undefined;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: u.protocol,
        hostname: address,
        port: u.port || undefined,
        path: u.pathname + u.search,
        servername: host,
        headers: { ...options.headers, host: u.host, 'accept-encoding': 'identity' },
        agent,
        signal: options.signal
      },
      (response) => {
        const { Readable } = require('node:stream');
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers))
          if (value !== undefined) headers.set(key, String(value));
        response.once('close', () => agent?.destroy());
        if ([204, 205, 304].includes(response.statusCode)) {
          response.resume();
          resolve(new Response(null, { status: response.statusCode, headers }));
        } else
          resolve(new Response(Readable.toWeb(response), { status: response.statusCode, headers }));
      }
    );
    request.on('error', reject);
    request.end();
  });
}
module.exports = { parseFeed, fetchFeed, normalizeLink, publicFetch };
