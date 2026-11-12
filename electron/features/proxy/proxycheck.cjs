const net = require('node:net');
function createProxycheckProvider({ fetchImpl = fetch } = {}) {
  return {
    id: 'proxycheck.io',
    async lookup(ip, signal) {
      if (!net.isIP(ip)) throw Error('INVALID_IP');
      const response = await fetchImpl(
        `https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&risk=1&asn=1&tag=0`,
        {
          signal,
          redirect: 'error',
          headers: { accept: 'application/json', 'user-agent': 'BLEGO/1.3' }
        }
      );
      if (response.status === 429) {
        await response.body?.cancel();
        throw Object.assign(Error('RATE_LIMITED'), { code: 'RATE_LIMITED' });
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw Error('PROVIDER_HTTP_ERROR');
      }
      if (Number(response.headers.get('content-length')) > 65536) {
        await response.body?.cancel();
        throw Error('PROVIDER_TOO_LARGE');
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error('PROVIDER_INVALID_RESPONSE');
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 65536) throw Error('PROVIDER_TOO_LARGE');
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const entry = data?.[ip];
      if (
        !['ok', 'warning'].includes(data.status) ||
        !entry ||
        !['yes', 'no'].includes(entry.proxy)
      )
        throw Error('PROVIDER_INVALID_RESPONSE');
      const short = (value) => (typeof value === 'string' ? value.slice(0, 150) : null);
      return {
        ip,
        proxy: entry.proxy === 'yes',
        hosting:
          typeof entry.type === 'string'
            ? /hosting|datacenter|data.center/i.test(entry.type)
            : null,
        vpn: typeof entry.type === 'string' ? /vpn/i.test(entry.type) : null,
        tor: typeof entry.type === 'string' ? /tor/i.test(entry.type) : null,
        risk:
          typeof entry.risk === 'number' &&
          Number.isFinite(entry.risk) &&
          entry.risk >= 0 &&
          entry.risk <= 100
            ? entry.risk
            : null,
        scale: [0, 100],
        type: short(entry.type),
        asn: short(entry.asn),
        provider: short(entry.provider),
        country: short(entry.country),
        updatedAt: short(entry.last_seen || entry.updated),
        warning: data.status === 'warning' ? 'PROVIDER_WARNING' : null
      };
    }
  };
}
module.exports = { createProxycheckProvider };
