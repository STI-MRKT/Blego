const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { resolvePreset } = require('./sources.cjs');
const { nameCount, usedNames, isPossibleName } = require('./naming.cjs');
const { registry } = require('./registry.cjs');
const { getSettings, countries } = require('../../local/settings.cjs');
const { readZip } = require('../archive/zip.cjs');
const MAX_INPUT = 50 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function loadDataset(store, country) {
  const key = store?.get(`generator:active:${country}`);
  if (!key) return null;
  const data = store.get(`generator:dataset:${key}`);
  if (!data) throw Error('DATASET_MISSING');
  return data;
}
function getPoolStats(
  { country, type },
  { store, settings = store ? getSettings(store) : {} } = {}
) {
  const p = resolvePreset(country, type, settings, loadDataset(store, country));
  const used = store ? registry(store, p) : { used: () => false };
  const unique = (values) => [...new Set(values)];
  const counts = {
    firstNames: p.first.length,
    lastNames: p.last.length,
    localities: unique(p.places.map((x) => x.city)).length,
    localityPostalLinks: p.places.length,
    bioTemplates: p.bios.length,
    statusTemplates: p.statuses.length,
    streetElements: p.streets.length
  };
  const capacities = {
    nameCombinations: {
      certainty: 'known',
      available:
        nameCount(p) -
        (store ? [...usedNames(store)].filter((name) => isPossibleName(p, name)).length : 0),
      scope: 'installation',
      repeatAllowed: p.allowRepeats.includes('name')
    },
    phone: {
      certainty: 'estimated',
      available: Math.max(
        0,
        p.capacity.phone - (store?.get(`phone-sequence:${p.phonePrefix}`) || 0)
      ),
      scope: 'synthetic format range, not verified unassigned numbers'
    },
    email: { certainty: 'unknown', available: null, scope: 'installation registry' },
    handle: { certainty: 'unknown', available: null, scope: 'installation registry' }
  };
  for (const [field, values] of [
    ['bio', p.bios],
    ['status', p.statuses],
    ['postalCode', p.places.map((x) => x.postal)]
  ]) {
    if (!p.fieldOrder.includes(field)) continue;
    capacities[field] = {
      certainty: 'known',
      available: unique(values).filter((value) => !used.used(field, value)).length,
      scope: ['bio', 'status'].includes(field) ? `${country}:${type}` : country,
      repeatAllowed: p.allowRepeats.includes(field)
    };
  }
  const strict = Object.entries(capacities).filter(
    ([key, value]) =>
      ['nameCombinations', 'bio', 'status', 'postalCode', 'phone'].includes(key) &&
      !value.repeatAllowed
  );
  const minimum = Math.min(...strict.map(([, value]) => value.available));
  const limitingFields = strict
    .filter(([, value]) => value.available === minimum)
    .map(([key]) => key);
  return {
    counts,
    installedVersions: store
      ? store.db
          .prepare(
            "SELECT key, json_extract(value, '$.datasetVersion') version FROM kv WHERE key LIKE 'generator:dataset:%' AND json_extract(value, '$.code')=?"
          )
          .all(country)
          .map((row) => ({ key: row.key.slice('generator:dataset:'.length), version: row.version }))
      : [],
    capacities,
    limitingFields,
    fullProfileCapacity: {
      certainty: 'estimated',
      upperBound: minimum,
      reason: 'Other optional fields and imported pool conflicts can exhaust earlier'
    },
    datasetVersions: { country: p.datasetVersion, type: p.version },
    datasetId: p.datasetId,
    normalizationVersion: p.normalizationVersion,
    deficits: {
      firstNames: Math.max(0, 500 - counts.firstNames),
      lastNames: Math.max(0, 500 - counts.lastNames),
      localities: Math.max(0, 50 - counts.localities),
      verifiedPostalLinks: Math.max(0, 200 - (p.provenance.geography.verifiedPostalLinks || 0)),
      streetElements: Math.max(0, 100 - counts.streetElements),
      bioTemplates: Math.max(0, 30 - counts.bioTemplates),
      statusTemplates: Math.max(0, 20 - counts.statusTemplates)
    }
  };
}
function validateDataset(raw) {
  const allowed = [
    'version',
    'code',
    'language',
    'first',
    'last',
    'places',
    'streets',
    'phonePrefix',
    'phoneDigits',
    'nationalPrefix',
    'schemaVersion',
    'datasetId',
    'datasetVersion',
    'nameGender',
    'preparedAt',
    'normalizationVersion',
    'provenance',
    'checksum'
  ];
  if (
    !raw ||
    Array.isArray(raw) ||
    typeof raw !== 'object' ||
    Object.keys(raw).some((k) => !allowed.includes(k))
  )
    throw Error('DATASET_INVALID');
  const data = structuredClone(raw);
  const checksum = data.checksum;
  delete data.checksum;
  if (
    hash(JSON.stringify(data)) !== checksum ||
    data.schemaVersion !== 1 ||
    !countries.includes(data.code) ||
    data.nameGender !== 'female'
  )
    throw Error('DATASET_INVALID');
  const text = (v) =>
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= 200 &&
    !/[\p{Cc}\p{Cf}]/u.test(v) &&
    v === v.normalize('NFKC').trim();
  if (
    ![
      'datasetId',
      'datasetVersion',
      'preparedAt',
      'normalizationVersion',
      'language',
      'version'
    ].every((k) => text(data[k]))
  )
    throw Error('DATASET_INVALID');
  if (!text(data.provenance?.names?.license) || !text(data.provenance?.names?.source))
    throw Error('DATASET_LICENSE_MISSING');
  if (
    !data.provenance.geography ||
    !Number.isInteger(data.provenance.geography.verifiedPostalLinks) ||
    data.provenance.geography.verifiedPostalLinks < 0
  )
    throw Error('DATASET_INVALID');
  for (const key of ['first', 'last', 'streets']) {
    if (
      !Array.isArray(data[key]) ||
      !data[key].length ||
      data[key].length > 50000 ||
      data[key].some((x) => !text(x)) ||
      new Set(data[key].map((x) => x.toLowerCase())).size !== data[key].length
    )
      throw Error('DATASET_INVALID');
  }
  if (data.first.some((x) => /\d/u.test(x)) || data.last.some((x) => /\d/u.test(x)))
    throw Error('DATASET_INVALID');
  if (
    !Array.isArray(data.places) ||
    !data.places.length ||
    data.places.length > 50000 ||
    data.places.some(
      (p) =>
        !p ||
        Object.keys(p).some((k) => !['city', 'postal'].includes(k)) ||
        !text(p.city) ||
        !text(p.postal)
    )
  )
    throw Error('DATASET_INVALID');
  // Country numbering rules cannot be expanded by an imported dictionary.
  const base = resolvePreset(data.code, 'model');
  for (const key of ['phonePrefix', 'phoneDigits', 'nationalPrefix', 'language'])
    if (data[key] !== base[key]) throw Error('DATASET_INVALID');
  if (data.provenance.geography.verifiedPostalLinks > data.places.length)
    throw Error('DATASET_INVALID');
  if (
    new Set(
      data.places.map(({ city, postal }) =>
        JSON.stringify([city.toLowerCase(), postal.toLowerCase()])
      )
    ).size !== data.places.length
  )
    throw Error('DATASET_INVALID');
  data.checksum = checksum;
  return data;
}
function createPoolCatalog({ store }) {
  const previews = new Map();
  async function read(file) {
    const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.size > MAX_INPUT) throw Error('DATASET_INVALID');
    const bytes = await fs.promises.readFile(file);
    if (bytes.length > MAX_INPUT) throw Error('DATASET_INVALID');
    let content = bytes;
    if (bytes.subarray(0, 2).toString() === 'PK') {
      const zip = await readZip(bytes, {
        maxFiles: 1024,
        maxDepth: 8,
        maxBytes: 256 * 1024 * 1024,
        validateContents: () => {}
      });
      if (
        Object.keys(zip.entries).some((name) => !['dataset.json', 'LICENSE.txt'].includes(name)) ||
        !zip.entries['dataset.json']
      )
        throw Error('DATASET_INVALID');
      content = zip.entries['dataset.json'];
    }
    let parsed;
    try {
      parsed = JSON.parse(content.toString('utf8'));
    } catch {
      throw Error('DATASET_INVALID');
    }
    const data = validateDataset(parsed);
    // Detect any change during the separate ZIP read too.
    if (hash(await fs.promises.readFile(file)) !== hash(bytes)) throw Error('SOURCE_CHANGED');
    return { data, digest: hash(bytes) };
  }
  return {
    async preview(file) {
      if (previews.size >= 4) throw Error('TOO_MANY_PREVIEWS');
      const { data, digest } = await read(file);
      const token = randomUUID();
      previews.set(token, { file, digest, data });
      return {
        status: 'preview',
        fileToken: token,
        country: data.code,
        datasetId: data.datasetId,
        datasetVersion: data.datasetVersion,
        counts: {
          firstNames: data.first.length,
          lastNames: data.last.length,
          localityPostalLinks: data.places.length
        },
        duplicates: 0,
        errors: [],
        sourceLicenses: [data.provenance.names.license]
      };
    },
    async apply(token) {
      const preview = previews.get(token);
      if (!preview) throw Error('INVALID_FILE_TOKEN');
      const { data, digest } = await read(preview.file);
      if (digest !== preview.digest) throw Error('SOURCE_CHANGED');
      store.transaction(() => {
        store.set(`generator:dataset:${data.checksum}`, data);
        store.set(`generator:active:${data.code}`, data.checksum);
      });
      previews.delete(token);
      return { status: 'installed', installedVersion: data.datasetVersion, country: data.code };
    },
    cancel(token) {
      return previews.delete(token);
    },
    useBundled(country) {
      if (!countries.includes(country)) throw Error('INVALID_COUNTRY');
      store.set(`generator:active:${country}`, null);
      return true;
    },
    select(country, key) {
      const data = store.get(`generator:dataset:${key}`);
      if (!countries.includes(country) || !data || data.code !== country)
        throw Error('DATASET_INVALID');
      store.set(`generator:active:${country}`, key);
      return true;
    }
  };
}
module.exports = { loadDataset, getPoolStats, validateDataset, createPoolCatalog };
