const fs = require('node:fs');
const targets = {
  femaleNames: 500,
  surnames: 500,
  localities: 50,
  verifiedPostalLinks: 200,
  streetElements: 100
};
const rows = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'].map((country) => {
  const p = JSON.parse(fs.readFileSync(`resources/generator/countries/${country}.json`));
  const unique = (x) => new Set(x.map((v) => v.normalize('NFKC').trim().toLowerCase())).size;
  const counts = {
    femaleNames: p.nameGender === 'female' ? unique(p.first) : 0,
    surnames: unique(p.last),
    localities: unique(p.places.map((p) => p.city)),
    verifiedPostalLinks: p.provenance.geography.verifiedPostalLinks || 0,
    streetElements: unique(p.streets)
  };
  return {
    country,
    counts,
    deficits: Object.fromEntries(
      Object.entries(targets).map(([k, n]) => [k, Math.max(0, n - counts[k])])
    )
  };
});
console.log(JSON.stringify({ targets, rows }, null, 2));
if (rows.some((r) => Object.values(r.deficits).some((x) => x > 0))) process.exitCode = 1;
