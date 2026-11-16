const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = '99c5a3ec074032ea9380de40d8ff78e7318716c9';
const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
const types = ['model', 'tech', 'crypto'];
const normalize = (value) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
function read(file, base) {
  const name = `resources/generator/${file}`;
  return JSON.parse(
    base
      ? execFileSync('git', ['show', `${base}:${name}`], { encoding: 'utf8' })
      : fs.readFileSync(name, 'utf8')
  );
}
function snapshot(base = null) {
  const names = read('supplements/names-v14.json', base);
  const bios = read('supplements/bios-v14.json', base);
  const data = Object.fromEntries(
    countries.map((country) => [country, read(`countries/${country}.json`, base)])
  );
  const typeData = Object.fromEntries(
    types.map((type) => [type, read(`types/${type}.json`, base)])
  );
  const nameValues = [
    ...Object.values(data).flatMap((row) => [...row.first, ...row.last]),
    ...names.brandNames,
    ...Object.values(names.personNames).flatMap((group) => Object.values(group).flat())
  ];
  const bioValues = types.flatMap((type) =>
    Object.keys(typeData[type].bios).flatMap((language) => [
      ...typeData[type].bios[language],
      ...bios.bios[type][language]
    ])
  );
  const addresses = base ? {} : read('supplements/addresses-tz12.json').records;
  return { data, names, bios, typeData, nameValues, bioValues, addresses };
}
function difference(before, after) {
  const old = new Set(before.map(normalize)),
    current = new Set(after.map(normalize));
  return {
    before: old.size,
    added: [...current].filter((value) => !old.has(value)).length,
    removed: [...old].filter((value) => !current.has(value)).length,
    after: current.size
  };
}
function report(before = snapshot(BASE), after = snapshot()) {
  return {
    base: BASE,
    method:
      'Globally unique NFKC/trim/lowercase/whitespace-normalized dictionary entries; no generated name/address combinations counted. US/GB shared English counted once.',
    names: difference(before.nameValues, after.nameValues),
    bios: difference(before.bioValues, after.bioValues),
    addresses: difference(
      [],
      Object.entries(after.addresses).flatMap(([country, rows]) =>
        rows.map((row) => JSON.stringify([country, row.city, row.postal, row.address]))
      )
    ),
    countries: Object.fromEntries(
      countries.map((country) => [
        country,
        {
          first: difference(before.data[country].first, after.data[country].first),
          last: difference(before.data[country].last, after.data[country].last),
          modelAndCrypto:
            'Both retain female personal-name strategy and use the added surname atoms; these atoms count once, not once per category.',
          addresses: after.addresses[country].length
        }
      ])
    ),
    tech: difference(before.names.brandNames, after.names.brandNames),
    localizedBios: Object.fromEntries(
      types.map((type) => [
        type,
        Object.fromEntries(
          Object.keys(after.bios.bios[type]).map((language) => [
            language,
            difference(before.bios.bios[type][language], after.bios.bios[type][language])
          ])
        )
      ])
    )
  };
}
if (require.main === module) {
  const result = JSON.stringify(report(), null, 2) + '\n';
  if (process.argv[2]) {
    fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });
    fs.writeFileSync(process.argv[2], result);
  } else process.stdout.write(result);
}
module.exports = { BASE, countries, types, normalize, snapshot, difference, report };
