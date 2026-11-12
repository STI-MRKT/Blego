// Development-only reproducible extraction. No dependency download at app startup.
// Usage: node scripts/prepare-name-data.mjs /absolute/path/to/faker-10.6.0/package
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const packagePath = path.resolve(process.argv[2] || '');
const info = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
if (info.name !== '@faker-js/faker' || info.version !== '10.6.0' || info.license !== 'MIT')
  throw Error('Expected reviewed @faker-js/faker 10.6.0 with MIT license');
const data = await import(pathToFileURL(path.join(packagePath, 'dist/index.js')));
const locales = {
  BR: 'pt_BR',
  US: 'en',
  FR: 'fr',
  PL: 'pl',
  DE: 'de',
  ES: 'es',
  IT: 'it',
  GB: 'en'
};
const normalize = (values) => [
  ...new Map(
    values
      .map((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))
      .filter((value) => value && value.length <= 120 && !/[\p{Cc}\p{Cf}\d]/u.test(value))
      .map((value) => [value.toLowerCase(), value])
  ).values()
];
const counts = [];
for (const [country, locale] of Object.entries(locales)) {
  const file = path.join('resources/generator/countries', `${country}.json`);
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete current.checksum;
  const person = data[locale].person;
  current.first = normalize(person.first_name.female);
  current.last = normalize(
    person.last_name.generic.map((name) =>
      country === 'PL' ? name.replace(/(s|c|dz)ki$/u, '$1ka').replace(/y$/u, 'a') : name
    )
  );
  current.version = '2';
  current.schemaVersion = 1;
  current.datasetId = `blego-${country.toLowerCase()}-female`;
  current.datasetVersion = '2026-11-12.1';
  current.nameGender = 'female';
  current.preparedAt = '2026-11-12';
  current.normalizationVersion = 'NFKC-name-v1';
  current.provenance = {
    names: {
      package: '@faker-js/faker',
      version: '10.6.0',
      locale,
      license: 'MIT',
      source: 'https://github.com/faker-js/faker/tree/v10.6.0/src/locales',
      firstNames: 'person.first_name.female only',
      surnames:
        country === 'PL'
          ? 'generic, feminine -ski/-cki/-dzki and -y adjective forms'
          : 'person.last_name.generic',
      notes:
        country === 'GB'
          ? 'English-language data; not UK population-frequency statistics'
          : 'Language-specific synthetic vocabulary; not nationality or real-person records'
    },
    geography: {
      source: 'Inherited BLEGO country resources at 6e57eab',
      verifiedPostalLinks: 0,
      notes:
        'Existing format examples retained; independent postal verification pending. Streets are synthetic profile components.'
    }
  };
  current.checksum = createHash('sha256').update(JSON.stringify(current)).digest('hex');
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  counts.push({
    country,
    femaleNames: current.first.length,
    surnames: current.last.length,
    localities: new Set(current.places.map((p) => p.city)).size,
    postalLinks: current.places.length,
    verifiedPostalLinks: 0,
    streetElements: current.streets.length
  });
}
fs.mkdirSync('resources/generator/licenses', { recursive: true });
fs.copyFileSync(path.join(packagePath, 'LICENSE'), 'resources/generator/licenses/faker-10.6.0.txt');
fs.writeFileSync('resources/generator/name-counts.json', JSON.stringify(counts, null, 2) + '\n');
console.log(JSON.stringify(counts, null, 2));
