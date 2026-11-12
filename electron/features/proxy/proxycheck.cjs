const net = require('node:net');

function createProxycheckProvider({ fetchImpl = fetch } = {}) {
  return {
    id: 'proxycheck.io',
    async lookup(ip, signal) {
      if (!net.isIP(ip)) throw Error('INVALID_IP');
      // Only the verified exit IP is sent, never the entered proxy host, port or credentials.
      const response = await fetchImpl(
        `https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&risk=1&asn=1&tag=0`,
        {
          signal,
          redirect: 'error',
          headers: { accept: 'application/json', 'user-agent': 'BLEGO/1.2' }
        }
      );
      if (response.status === 429) {
        const error = Error('RATE_LIMITED');
        error.code = 'RATE_LIMITED';
        throw error;
      }
      if (!response.ok) throw Error('PROVIDER_HTTP_ERROR');
      if (Number(response.headers.get('content-length') || 0) > 65536)
        throw Error('PROVIDER_TOO_LARGE');
      const reader = response.body?.getReader();
      if (!reader) throw Error('PROVIDER_INVALID_RESPONSE');
      let bytes = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 65536) throw Error('PROVIDER_TOO_LARGE');
          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const entry = data?.[ip];
      if (!['ok', 'warning'].includes(data?.status) || !entry ||
          !['yes', 'no'].includes(entry.proxy))
        throw Error('PROVIDER_INVALID_RESPONSE');
      const risk = Number(entry.risk);
      return {
        proxy: entry.proxy === 'yes',
        hosting: /hosting|datacenter|data.center/i.test(String(entry.type || '')),
        vpn: /vpn/i.test(String(entry.type || '')),
        tor: /tor/i.test(String(entry.type || '')),
        type: String(entry.type || 'unknown').slice(0, 60),
        risk: Number.isFinite(risk) && risk >= 0 && risk <= 100 && entry.risk !== null
          ? Math.round(risk)
          : null,
        country: typeof entry.country === 'string' ? entry.country.slice(0, 120) : null,
        asn: typeof entry.asn === 'string' ? entry.asn.slice(0, 120) : null
      };
    }
  };
}
module.exports = { createProxycheckProvider };
