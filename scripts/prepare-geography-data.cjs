// Offline reproducible build-time import. No application-time network requests.
const fs = require('node:fs'),
  path = require('node:path'),
  { createHash } = require('node:crypto');
const { readZip } = require('../electron/features/archive/zip.cjs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const directory = process.argv[2];
  if (!directory) throw Error('Pass directory containing reviewed country archives');
  const sources = JSON.parse(
    fs.readFileSync('docs/verification/data/geonames-2026-11-12.json', 'utf8')
  );
  for (const source of sources) {
    // GB.zip has outward codes only. Never present those as complete UK postcodes.
    if (source.country === 'GB') continue;
    const archive = path.join(directory, source.country + '.zip');
    if (hash(fs.readFileSync(archive)) !== source.sha256) throw Error('SOURCE_CHECKSUM_MISMATCH');
    const { entries } = await readZip(archive, {
      maxBytes: 32 * 1024 * 1024,
      maxFiles: 3,
      validateContents: () => {}
    });
    const notice = entries['readme.txt'].toString('utf8');
    if (!notice.includes('Creative Commons Attribution 4.0'))
      throw Error('LICENSE_REVIEW_REQUIRED');
    fs.writeFileSync('resources/generator/licenses/geonames-postal-readme.txt', notice);
    const clean = (x) => x.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    const available = entries[source.country + '.txt']
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((row) => row[0] === source.country)
      .map((row) => ({ city: clean(row[2]), postal: clean(row[1]) }))
      .filter(
        (p) =>
          p.city &&
          p.city.length <= 120 &&
          p.postal &&
          p.postal.length <= 20 &&
          !/[\p{Cc}\p{Cf}]/u.test(p.city + p.postal)
      );
    const pairs = [
      ...new Map(
        available.map((p) => [JSON.stringify([p.city.toLowerCase(), p.postal.toLowerCase()]), p])
      ).values()
    ].sort((a, b) => (a.city < b.city ? -1 : a.city > b.city ? 1 : a.postal < b.postal ? -1 : 1));
    const places = [],
      cities = new Set();
    for (const pair of pairs) {
      if (!cities.has(pair.city.toLowerCase())) {
        places.push(pair);
        cities.add(pair.city.toLowerCase());
      }
      if (places.length === 500) break;
    }
    if (places.length < 500) throw Error('INSUFFICIENT_SOURCE_LOCALITIES');
    const file = `resources/generator/countries/${source.country}.json`,
      data = JSON.parse(fs.readFileSync(file));
    delete data.checksum;
    data.places = places;
    data.version = '3';
    data.datasetVersion = '2026-11-12.2';
    data.provenance.geography = {
      source: source.url,
      license: 'CC-BY-4.0',
      archiveSha256: source.sha256,
      retrievedAt: '2026-11-12',
      sourcePairedPostalLinks: places.length,
      verifiedPostalLinks: 0,
      notes:
        'Exact locality/postal pairs from GeoNames, with NFKC/whitespace normalization. Independent second-source postal verification has not been performed; no coordinates or real household data imported. BR covers major municipal codes only.'
    };
    data.checksum = hash(JSON.stringify(data));
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  const counts = sources.map(({ country }) => {
    const p = JSON.parse(fs.readFileSync(`resources/generator/countries/${country}.json`));
    return {
      country,
      femaleNames: p.first.length,
      surnames: p.last.length,
      localities: new Set(p.places.map((x) => x.city)).size,
      postalLinks: p.places.length,
      verifiedPostalLinks: p.provenance.geography.verifiedPostalLinks,
      streetElements: p.streets.length
    };
  });
  fs.writeFileSync('resources/generator/name-counts.json', JSON.stringify(counts, null, 2) + '\n');
  console.log(
    'Imported 500 source-paired localities for seven countries; GB unchanged; independently verified count remains zero.'
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
