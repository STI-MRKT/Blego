function assess(sources, expectedIp) {
  const measured = sources.find(
    (s) =>
      s.status === 'ok' &&
      s.id === 'proxycheck.io' &&
      typeof expectedIp === 'string' &&
      s.ip === expectedIp &&
      typeof s.risk === 'number' &&
      Number.isFinite(s.risk) &&
      s.risk >= 0 &&
      s.risk <= 100 &&
      s.scale?.[0] === 0 &&
      s.scale?.[1] === 100
  );
  const trust = {
    trustScore: measured ? 100 - measured.risk : null,
    trustSource: measured ? measured.id : null
  };
  return {
    ...trust,
    name: 'IP Trust',
    version: 'proxycheck-v2-100-minus-risk',
    score: trust.trustScore,
    status: measured ? 'available' : 'insufficient_data',
    factors: [],
    description: '100 minus the reported provider risk; not a probability or latency rating.'
  };
}
module.exports = { assess };
