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
        if (
          !data ||
          typeof data.proxy !== 'boolean' ||
          (typeof data.hosting !== 'boolean' && data.hosting !== null)
        )
          return { id: p.id, status: 'invalid_response' };
        return {
          id: p.id,
          status: 'ok',
          ip: data.ip === ip ? ip : null,
          risk:
            typeof data.risk === 'number' &&
            Number.isFinite(data.risk) &&
            data.risk >= 0 &&
            data.risk <= 100
              ? data.risk
              : null,
          scale:
            Array.isArray(data.scale) && data.scale[0] === 0 && data.scale[1] === 100
              ? [0, 100]
              : null,
          type: data.type,
          asn: data.asn,
          provider: data.provider,
          country: data.country,
          vpn: data.vpn,
          tor: data.tor,
          updatedAt: data.updatedAt,
          warning: data.warning,
          proxy: data.proxy,
          hosting: data.hosting,
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
