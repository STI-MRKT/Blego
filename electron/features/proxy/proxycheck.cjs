const net = require('node:net');
const { withAbort } = require('../facebook/transport.cjs');
const { isPublicAddress } = require('../../local/network-safety.cjs');
// API v3 stable 2026-06-24: risk is detections.risk, not confidence.
function createProxycheckProvider({
  fetchImpl = fetch,
  getKey = () => null,
  clock = Date.now,
  timeoutMs = 10000
} = {}) {
  const cache = new Map();
  return {
    id: 'proxycheck.io',
    clear() {
      cache.clear();
    },
    async lookup(ip, signal) {
      if (signal?.aborted) throw Error('CANCELLED');
      if (!net.isIP(ip) || !isPublicAddress(ip)) throw Error('INVALID_IP');
      const old = cache.get(ip);
      if (old && old.expiresAt > clock()) return { ...old.data, cached: true };
      const timed = AbortSignal.timeout(timeoutMs),
        combined = AbortSignal.any([signal, timed]);
      try {
        const key = getKey();
        const url = new URL(`https://proxycheck.io/v3/${encodeURIComponent(ip)}`);
        if (key) url.searchParams.set('key', key);
        const response = await withAbort(
          fetchImpl(url.href, {
            signal: combined,
            redirect: 'error',
            headers: { accept: 'application/json', 'user-agent': 'BLEGO/1.3' }
          }),
          combined
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw Error(
            { 401: 'PROVIDER_AUTH', 403: 'PROVIDER_DENIED', 429: 'RATE_LIMITED' }[
              response.status
            ] || 'PROVIDER_HTTP_ERROR'
          );
        }
        if (Number(response.headers.get('content-length')) > 65536) {
          await response.body?.cancel();
          throw Error('PROVIDER_TOO_LARGE');
        }
        const reader = response.body?.getReader();
        if (!reader) throw Error('PROVIDER_INVALID_RESPONSE');
        const chunks = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await withAbort(reader.read(), combined);
            if (done) break;
            size += value.length;
            if (size > 65536) throw Error('PROVIDER_TOO_LARGE');
            chunks.push(Buffer.from(value));
          }
        } finally {
          reader.cancel().catch(() => {});
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          throw Error('PROVIDER_INVALID_RESPONSE');
        }
        const entry = body?.[ip],
          d = entry?.detections;
        if (!['ok', 'warning'].includes(body.status) || !d || typeof d !== 'object')
          throw Error('PROVIDER_INVALID_RESPONSE');
        const risk =
          typeof d.risk === 'number' && Number.isFinite(d.risk) && d.risk >= 0 && d.risk <= 100
            ? d.risk
            : null;
        const short = (v) => (typeof v === 'string' ? v.slice(0, 150) : null);
        const data = {
          ip,
          risk,
          scale: [0, 100],
          confidence: typeof d.confidence === 'number' ? d.confidence : null,
          ...Object.fromEntries(
            ['proxy', 'vpn', 'hosting', 'tor', 'anonymous', 'compromised', 'scraper'].map((k) => [
              k,
              typeof d[k] === 'boolean' ? d[k] : null
            ])
          ),
          type: short(entry.network?.type),
          asn: short(entry.network?.asn),
          provider: short(entry.network?.provider),
          country: short(entry.location?.country_name),
          updatedAt: short(entry.last_updated),
          checkedAt: new Date(clock()).toISOString(),
          warning: body.status === 'warning' ? 'PROVIDER_WARNING' : null
        };
        let ttl = d.anonymous === true ? 60000 : 600000;
        const delist = Date.parse(entry.detection_history?.delist_datetime);
        if (d.anonymous === true && Number.isFinite(delist))
          ttl = Math.min(ttl, Math.max(0, delist - clock()));
        data.expiresAt = new Date(clock() + ttl).toISOString();
        if (cache.size >= 128) cache.delete(cache.keys().next().value);
        cache.set(ip, { data, expiresAt: clock() + ttl });
        return data;
      } catch (e) {
        if (signal?.aborted) throw Error('CANCELLED');
        if (timed.aborted) throw Error('PROVIDER_TIMEOUT');
        const code = [
          'PROVIDER_AUTH',
          'PROVIDER_DENIED',
          'RATE_LIMITED',
          'PROVIDER_HTTP_ERROR',
          'PROVIDER_INVALID_RESPONSE',
          'PROVIDER_TOO_LARGE',
          'SECURE_STORAGE_UNAVAILABLE'
        ].includes(e.message)
          ? e.message
          : 'PROVIDER_UNAVAILABLE';
        throw Object.assign(Error(code), { code });
      }
    }
  };
}
module.exports = { createProxycheckProvider };
