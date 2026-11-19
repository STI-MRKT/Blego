'use strict';
// Diagnostic only: public editorial feed URLs; do not log credentials or proxy secrets.
const { NEWS_SOURCES } = require('../shared/news-catalog.mjs');
const { fetchFeed, publicFetch, parseFeed } = require('../electron/features/news/feeds.cjs');
const { resolvePublic } = require('../electron/local/network-safety.cjs');
const selected = ['decrypt', 'guardian-fashion', 'bbc-business'];
const safeError = (error) => ({
  name: String(error?.name || ''),
  code: String(error?.code || error?.cause?.code || ''),
  message: String(error?.message || '').slice(0, 200),
  cause: String(error?.cause?.message || '').slice(0, 180)
});
(async () => {
  const result = { node: process.version, env: {
    HTTPS_PROXY: Boolean(process.env.HTTPS_PROXY || process.env.https_proxy),
    HTTP_PROXY: Boolean(process.env.HTTP_PROXY || process.env.http_proxy),
    NO_PROXY: Boolean(process.env.NO_PROXY || process.env.no_proxy)
  }, sources: [] };
  for (const id of selected) {
    const source = NEWS_SOURCES.find((x) => x.id === id);
    if (!source) continue;
    const checks = { id, host: new URL(source.url).hostname };
    try { checks.resolvedIP = await resolvePublic(checks.host, AbortSignal.timeout(8000)); }
    catch (e) { checks.dnsError = safeError(e); }
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(12000) });
      checks.nativeFetch = { status: res.status, contentType: res.headers.get('content-type') };
      await res.body?.cancel();
    } catch (e) { checks.nativeFetchError = safeError(e); }
    try {
      const res = await publicFetch(source.url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/rss+xml', 'user-agent':'BLEGO/1.4.14' } });
      checks.customFetch = { status: res.status, contentType: res.headers.get('content-type') };
      await res.body?.cancel();
    } catch (e) { checks.customFetchError = safeError(e); }
    try {
      const xml = await fetchFeed(source.url, AbortSignal.timeout(12000));
      checks.parse = { bytes: Buffer.byteLength(xml), accepted: parseFeed(xml, source).length };
    } catch (e) { checks.parseError = safeError(e); }
    result.sources.push(checks);
  }
  console.log('TZ32_NEWS_PROBE', JSON.stringify(result));
  if (!result.sources.some((item) => item.parse?.accepted > 0)) process.exitCode = 1;
})().catch((e) => { console.error('TZ32_NEWS_PROBE_FATAL', safeError(e)); process.exitCode = 1; });
