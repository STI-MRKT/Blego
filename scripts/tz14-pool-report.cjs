const fs = require('node:fs');
const path = require('node:path');
const { resolvePreset } = require('../electron/features/generator/sources.cjs');
const nameSupplement = require('../resources/generator/supplements/names-v14.json');
const bioSupplement = require('../resources/generator/supplements/bios-v14.json');
const addressSupplement = require('../resources/generator/supplements/addresses-tz12.json');
const { COUNT } = require('../electron/features/generator/pool-expansion.cjs');

const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
const types = ['model', 'tech', 'crypto'];
const report = { dataset: 'BLEGO TZ14', createdAt: '2026-11-17', expandedBy: COUNT, pools: [] };
for (const country of countries) {
  const original = require('../resources/generator/countries/' + country + '.json');
  for (const type of types) {
    const preset = resolvePreset(country, type);
    const baseType = require('../resources/generator/types/' + type + '.json');
    const before = {
      firstNames: original.first.length,
      lastNames: original.last.length,
      streetNames: original.streets.length,
      addresses: addressSupplement.records[country].length,
      cityPostalPairs: original.places.length,
      bios: baseType.bios[original.language].length + bioSupplement.bios[type][original.language].length,
      statuses: (Array.isArray(baseType.statuses) ? baseType.statuses : baseType.statuses[original.language]).length,
      categories: baseType.categories.length,
      roles: 0,
      // Person-name supplements are explicit personal names; brands are separate.
      brandNames: type === 'tech' ? nameSupplement.brandNames.length : 0
    };
    const after = {
      firstNames: preset.first.length,
      lastNames: preset.last.length,
      streetNames: preset.streets.length,
      addresses: preset.addresses.length,
      cityPostalPairs: preset.places.length,
      bios: preset.bios.length,
      statuses: preset.statuses.length,
      categories: preset.categoryPool.length,
      roles: preset.positionPool.length,
      brandNames: preset.brandNames.length
    };
    const deltas = Object.fromEntries(Object.keys(before).map((key) => [key, after[key] - before[key]]));
    for (const key of ['firstNames','lastNames','streetNames','addresses','bios','statuses','categories','roles'])
      if (deltas[key] < COUNT) throw Error('POOL_NOT_EXPANDED: ' + country + '/' + type + '/' + key);
    if (deltas.cityPostalPairs !== 0) throw Error('UNVERIFIED_GEO_MODIFIED');
    if (type === 'crypto' && preset.brandNames.length < 1000) throw Error('CRYPTO_BRAND_EXHAUSTION');
    report.pools.push({ country, type, before, after, deltas });
  }
}
report.officialInstitutions = {
  count: require('../resources/generator/institutions.json').length,
  status: 'unchanged: requires verified official sources'
};
report.geoStatus = 'Bundled verified city/postal source pairs remain unchanged';
report.phone = 'Stored E.164 values remain unchanged; only displayed/copied value follows XXX-XXX-XXXX';
const output = process.argv[2];
if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  presets: report.pools.length,
  minimumAdded: Math.min(...report.pools.flatMap((p) =>
    ['firstNames','lastNames','streetNames','addresses','bios','statuses','categories','roles']
      .map((k) => p.deltas[k]))),
  changedVerifiedGeo: 0,
  cryptoBrandsPerCountry: report.pools.find((p) => p.type === 'crypto').after.brandNames,
  institutions: report.officialInstitutions.count
}));
