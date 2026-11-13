const { randomUUID, randomInt } = require('node:crypto');
const { resolvePreset, transliterate } = require('./sources.cjs');
const { selectName, ensureNameRegistry, usedNames } = require('./naming.cjs');
const { registry } = require('./registry.cjs');
const { getSettings } = require('../../local/settings.cjs');
const { loadDataset } = require('./catalog.cjs');
function exhausted(field, p) {
  const e = Error(`POOL_EXHAUSTED: ${field} (${p.country}:${p.type})`);
  e.code = 'POOL_EXHAUSTED';
  e.details = { field, scope: `${p.country}:${p.type}` };
  throw e;
}
async function generateProfile(
  request,
  { store, settings = getSettings(store), clock = () => new Date() } = {}
) {
  if (
    !request ||
    typeof request.requestId !== 'string' ||
    request.requestId.length > 100 ||
    !request.requestId
  )
    throw Error('INVALID_REQUEST');
  const p = resolvePreset(
    request.country,
    request.type,
    settings,
    loadDataset(store, request.country)
  );
  await ensureNameRegistry(store);
  return store.transaction(() => {
    const old = store.db
      .prepare('SELECT profile FROM requests WHERE request_id=?')
      .get(request.requestId);
    if (old) {
      const profile = JSON.parse(old.profile);
      if (profile.country !== p.country || profile.type !== p.type) throw Error('REQUEST_CONFLICT');
      return profile;
    }
    const r = registry(store, p);
    const id = randomUUID();
    const values = {};
    const pick = (a) => a[randomInt(a.length)];
    const finite = (f, a) => {
      const choices = p.allowRepeats.includes(f) ? a : a.filter((x) => !r.used(f, x));
      if (!choices.length) exhausted(f, p);
      return pick(choices);
    };
    if (p.pool) {
      const row = p.pool.find(
        (row) =>
          ['phone', 'email', 'handle'].every((f) => !r.used(f, row[f])) &&
          (p.allowRepeats.includes('name') || !r.used('name', row.name))
      );
      if (!row) exhausted('pool', p);
      if (typeof row.name !== 'string' || !row.name.trim()) throw Error('INVALID_POOL_NAME');
      if (
        p.namingStrategy === 'person_name' &&
        !p.first.some((name) => row.name.startsWith(name + ' '))
      )
        throw Error('POOL_NAME_NOT_FEMALE');
      Object.assign(values, row);
      if (
        !new RegExp(`^\\+${p.phonePrefix}\\d{${p.phoneDigits}}$`).test(values.phone) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
      )
        throw Error('INVALID_POOL_CONTACT');
    } else {
      values.name = selectName(p, usedNames(store));
      if (!values.name) exhausted('name', p);
      const base =
        transliterate(values.name).replaceAll('-', '.').slice(0, 47).replace(/\.+$/u, '') ||
        'profile';
      const suffix = id.replaceAll('-', '');
      values.handle = `${p.type}.${base.slice(0, 20)}.${suffix}`;
      let emailCounter = store.get(`email-sequence:dayrep:${base}`) || 0;
      values.email = `${base}${emailCounter ? '.' + emailCounter : ''}@dayrep.com`;
      while (r.used('email', values.email)) {
        if (++emailCounter > Number.MAX_SAFE_INTEGER - 1) exhausted('email', p);
        values.email = `${base}.${emailCounter}@dayrep.com`;
      }
      store.set(`email-sequence:dayrep:${base}`, emailCounter + 1);
      let counter = store.get(`phone-sequence:${p.phonePrefix}`) || 0;
      // Shared dialing codes share a counter across countries/types. No probabilistic retry loop.
      if (counter >= 10 ** (p.phoneDigits - p.nationalPrefix.length)) exhausted('phone', p);
      values.phone = `+${p.phonePrefix}${p.nationalPrefix}${String(counter).padStart(p.phoneDigits - p.nationalPrefix.length, '0')}`;
      let attempts = 0;
      while (r.used('phone', values.phone)) {
        if (++attempts > 10000 || ++counter >= 10 ** (p.phoneDigits - p.nationalPrefix.length))
          exhausted('phone', p);
        values.phone = `+${p.phonePrefix}${p.nationalPrefix}${String(counter).padStart(p.phoneDigits - p.nationalPrefix.length, '0')}`;
      }
      store.set(`phone-sequence:${p.phonePrefix}`, counter + 1);
    }
    const has = (f) => p.fieldOrder.includes(f);
    for (const [f, a] of [
      ['bio', p.bios],
      ['status', p.statuses]
    ])
      if (has(f) && values[f] === undefined) values[f] = finite(f, a);
    const places = p.places.filter(
      (x) =>
        !has('postalCode') ||
        p.allowRepeats.includes('postalCode') ||
        !r.used('postalCode', x.postal)
    );
    if ((has('city') || has('postalCode')) && !places.length) exhausted('postalCode', p);
    const place = pick(places.length ? places : p.places);
    if (has('city') && !values.city) values.city = place.city;
    if (has('postalCode') && !values.postalCode) values.postalCode = place.postal;
    if (has('address') && !values.address)
      values.address = finite(
        'address',
        p.streets.flatMap((s) => Array.from({ length: 240 }, (_, i) => `${s} ${i + 1}`))
      );
    if (has('number') && !values.number) {
      const n = store.get(`number:${p.country}`) || 0;
      values.number = String(n).padStart(6, '0');
      store.set(`number:${p.country}`, n + 1);
    }
    if (has('categories') && !values.categories) values.categories = p.categories;
    if (has('symbols') && values.symbols === undefined) values.symbols = p.symbols;
    for (const f of p.fieldOrder) if (values[f] === undefined) throw Error('INCOMPLETE_PROFILE');
    if (!r.used('name', values.name)) r.reserve('name', values.name, id);
    r.reserve('id', id, id);
    for (const f of [
      'phone',
      'email',
      'handle',
      'bio',
      'status',
      'number',
      'postalCode',
      'address'
    ]) {
      if (values[f] === undefined || p.allowRepeats.includes(f)) continue;
      if (r.used(f, values[f])) exhausted(f, p);
      r.reserve(f, values[f], id);
    }
    const result = {
      id,
      country: p.country,
      type: p.type,
      nameGender: p.nameGender,
      namingStrategy: p.namingStrategy,
      namingDatasetId: p.namingDatasetId,
      datasetId: p.datasetId,
      datasetVersion: p.datasetVersion,
      transliterationVersion: 'latin-v1',
      fields: values,
      fieldOrder: p.fieldOrder,
      rulesVersion: p.rulesVersion,
      createdAt: clock().toISOString(),
      uniquenessSummary: {
        scope: 'local installation history',
        normalization: 'NFKC-v1',
        allowRepeats: p.allowRepeats,
        capacity: p.capacity,
        syntheticPhone: true
      }
    };
    store.db
      .prepare('INSERT OR IGNORE INTO rule_versions VALUES(?,?)')
      .run(p.rulesVersion, JSON.stringify(p));
    store.db
      .prepare('INSERT INTO requests VALUES(?,?,?)')
      .run(request.requestId, id, JSON.stringify(result));
    store.set('lastCard', result);
    return result;
  });
}
function clearCard(store) {
  store.set('lastCard', null);
}
module.exports = { generateProfile, clearCard };
