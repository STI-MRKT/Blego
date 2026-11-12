const formula = require('./formula.json');
function assess(sources) {
  const good = sources.filter((s) => s.status === 'ok');
  if (good.length < formula.minimumSuccessfulSources)
    return {
      name: formula.name,
      version: formula.version,
      score: null,
      status: 'insufficient_data',
      factors: []
    };
  const factors = Object.entries(formula.weights)
    .filter(([flag]) => good.some((s) => s[flag] === true))
    .map(([flag, weight]) => ({ flag, weight }));
  return {
    name: formula.name,
    version: formula.version,
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
