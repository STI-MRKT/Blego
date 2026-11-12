async function lookupProviders(ip, providers, signal) {
  if (!providers.length) return [{ id: 'reputation', status: 'not_configured' }];
  return Promise.all(
    providers.map(async (p) => {
      const stage = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      let onAbort;
      try {
        const data = await Promise.race([
          p.lookup(ip, stage),
          new Promise((_, reject) => {
            onAbort = () => reject(Error('unavailable'));
            stage.addEventListener('abort', onAbort, { once: true });
            if (stage.aborted) onAbort();
          })
        ]);
        if (!data || typeof data.proxy !== 'boolean' || typeof data.hosting !== 'boolean')
          return { id: p.id, status: 'invalid_response' };
        return {
          id: p.id,
          status: 'ok',
          proxy: data.proxy,
          hosting: data.hosting,
          risk: Number.isInteger(data.risk) && data.risk >= 0 && data.risk <= 100 ? data.risk : null,
          vpn: data.vpn === true,
          tor: data.tor === true,
          type: typeof data.type === 'string' ? data.type : null,
          country: typeof data.country === 'string' ? data.country : null,
          asn: typeof data.asn === 'string' ? data.asn : null,
          checkedAt: new Date().toISOString()
        };
      } catch (e) {
        return { id: p.id, status: e.code === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable' };
      } finally {
        stage.removeEventListener('abort', onAbort);
      }
    })
  );
}
module.exports = { lookupProviders };
