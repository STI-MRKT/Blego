function assess(sources, expectedIp) {
  const measured = sources.find(
    (s) =>
      s.status === 'ok' &&
      s.id === 'proxycheck.io' &&
      s.ip === expectedIp &&
      typeof expectedIp === 'string' &&
      typeof s.risk === 'number' &&
      Number.isFinite(s.risk) &&
      s.risk >= 0 &&
      s.risk <= 100 &&
      s.scale?.[0] === 0 &&
      s.scale?.[1] === 100 &&
      (!s.expiresAt || Date.parse(s.expiresAt) > Date.now())
  );
  const score = measured ? 100 - measured.risk : null;
  return {
    name: 'IP Trust',
    version: 'proxycheck-v3-100-minus-risk',
    score,
    trustScore: score,
    trustSource: measured?.id || null,
    status: measured ? 'available' : 'insufficient_data',
    factors: measured
      ? ['proxy', 'vpn', 'hosting', 'tor', 'compromised', 'scraper']
          .filter((k) => measured[k] === true)
          .map((flag) => ({ flag }))
      : [],
    description: '100 minus provider risk; not a safety guarantee or connection quality.'
  };
}
function quality(attempts) {
  const good = attempts.filter((a) => Number.isFinite(a.ms) && a.ms >= 0),
    rtts = good.map((a) => a.ms);
  const mean = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
  const jitter =
    rtts.length > 1
      ? rtts.slice(1).reduce((sum, v, i) => sum + Math.abs(v - rtts[i]), 0) / (rtts.length - 1)
      : null;
  const enough = attempts.length >= 3 && good.length >= 2;
  const score = enough
    ? Math.round(
        100 *
          (good.length / attempts.length) *
          (0.7 + 0.2 * Math.max(0, 1 - mean / 1000) + 0.1 * Math.max(0, 1 - jitter / 200))
      )
    : null;
  return {
    score,
    status: enough ? 'available' : 'insufficient_data',
    attempts: attempts.length,
    successes: good.length,
    minMs: rtts.length ? Math.min(...rtts) : null,
    meanMs: mean,
    jitterMs: jitter,
    method: 'HTTPS round-trip',
    formula: 'https-quality-1'
  };
}
module.exports = { assess, quality };
