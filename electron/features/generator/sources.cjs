const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { countries, validateSettings } = require('../../local/settings.cjs');
const fields = [
  'name',
  'handle',
  'phone',
  'email',
  'postalCode',
  'city',
  'address',
  'bio',
  'status',
  'number',
  'categories',
  'symbols'
];
const root = path.join(__dirname, '../../../resources/generator');
function validateOverride(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw Error('INVALID_RULES');
  for (const [k, v] of Object.entries(o)) {
    if (!['bios', 'statuses', 'categories', 'symbols', 'fieldOrder', 'pool'].includes(k))
      throw Error('INVALID_RULES');
    if (k === 'symbols') {
      if (typeof v !== 'string' || v.length > 1000) throw Error('INVALID_RULES');
    } else if (k === 'pool') {
      if (!Array.isArray(v) || !v.length || v.length > 10000) throw Error('INVALID_POOL');
      for (const row of v) {
        if (
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          Object.keys(row).some((k) => !fields.includes(k)) ||
          Object.values(row).some(
            (x) =>
              typeof x !== 'string' && !(Array.isArray(x) && x.every((y) => typeof y === 'string'))
          ) ||
          !row.phone ||
          !row.email ||
          !row.handle
        )
          throw Error('INVALID_POOL');
      }
    } else if (
      !Array.isArray(v) ||
      !v.length ||
      v.length > 1000 ||
      v.some((x) => typeof x !== 'string' || x.length > 4000) ||
      new Set(v.map((x) => x.normalize('NFKC').trim().toLowerCase())).size !== v.length
    )
      throw Error('INVALID_RULES');
  }
}
function resolvePreset(country, type, settings = {}) {
  validateSettings(settings);
  if (!countries.includes(country) || !['model', 'tech', 'crypto'].includes(type))
    throw Error('INVALID_PRESET');
  const c = JSON.parse(fs.readFileSync(path.join(root, `countries/${country}.json`), 'utf8'));
  const t = JSON.parse(fs.readFileSync(path.join(root, `types/${type}.json`), 'utf8'));
  const o = settings.overrides || {};
  if (Object.keys(o).some((k) => !['common', 'types', 'pairs'].includes(k)))
    throw Error('INVALID_RULES');
  for (const value of [o.common, ...Object.values(o.types || {}), ...Object.values(o.pairs || {})])
    if (value) validateOverride(value);
  const p = {
    ...c,
    ...t,
    bios: t.bios[c.language],
    symbols: settings.symbols || '',
    ...o.common,
    ...o.types?.[type],
    ...o.pairs?.[`${country}:${type}`]
  };
  const order = settings.fieldOrder?.length ? settings.fieldOrder : p.fieldOrder;
  if (order.some((k) => !fields.includes(k))) throw Error('INVALID_FIELD_ORDER');
  p.fieldOrder = [...new Set([...order, ...fields])].filter(
    (f) => !settings.disabledFields?.includes(f)
  );
  p.allowRepeats = settings.allowRepeats || [];
  p.country = country;
  p.type = type;
  p.rulesVersion =
    'v1-' + createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 20);
  p.capacity = {
    bio: p.bios.length,
    status: p.statuses.length,
    postalCode: new Set(p.places.map((x) => x.postal)).size,
    phone: 10 ** (p.phoneDigits - p.nationalPrefix.length),
    pool: p.pool?.length ?? null
  };
  return p;
}
module.exports = { resolvePreset, fields };
