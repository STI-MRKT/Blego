const formula = require('./formula.json');
function assess(sources) {
  const good = sources.filter((s) => s.status === 'ok');
  if (good.length < formula.minimumSuccessfulSources)
    return {
      name: formula.name,
      version: formula.version,
      score: null,
      trustScore: null,
      trustSource: null,
      status: 'insufficient_data',
      factors: []
    };
  const measured = good.find((source) =>
    source.id === 'proxycheck.io' && Number.isInteger(source.risk) &&
    source.risk >= 0 && source.risk <= 100
  );
  const trust = measured ? 100 - measured.risk : null;
  const factors = Object.entries(formula.weights)
    .filter(([flag]) => good.some((s) => s[flag] === true))
    .map(([flag, weight]) => ({ flag, weight }));
  return {
    name: formula.name,
    version: formula.version,
    trustScore: trust,
    trustSource: measured ? measured.id : null,
    score: Math.min(
      100,
      factors.reduce((n, f) => n + f.weight, 0)
    ),
    status: 'available',
    factors,
    description: formula.description
  };
}
module.exports = { assess };
