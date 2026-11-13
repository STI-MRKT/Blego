const { randomUUID } = require('node:crypto');
const {
  validateBiographyValues,
  bioDefaults,
  bioSuggestions,
  organizationOptions
} = require('./biography.cjs');
const catalog = require('../../../resources/generator/institutions.json');
const { countries } = require('../../local/settings.cjs');
const { loadDataset } = require('./catalog.cjs');
const KEY = 'bio:workspace';
function parameters(input, draft = false) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['country', 'city', 'postalCode', 'type'].includes(k)) ||
    !countries.includes(input.country) ||
    !['model', 'tech', 'crypto'].includes(input.type) ||
    typeof input.city !== 'string' ||
    (!draft && !input.city.trim()) ||
    input.city.length > 120 ||
    (input.postalCode !== undefined &&
      (typeof input.postalCode !== 'string' || input.postalCode.length > 20)) ||
    /[\u0000-\u001f]/.test(input.city + (input.postalCode || ''))
  )
    throw Error('INVALID_BIO_PARAMETERS');
  return {
    country: input.country,
    city: input.city.trim(),
    postalCode: input.postalCode || '',
    type: input.type
  };
}
const asProfile = (p) => ({
  country: p.country,
  type: p.type,
  namingStrategy: 'person_name',
  fields: { city: p.city, postalCode: p.postalCode }
});
function createBiographyWorkspace({ store }) {
  function legacy(id) {
    if (!id.startsWith('legacy:')) return null;
    const row = store.db
      .prepare('SELECT profile FROM requests WHERE profile_id=?')
      .get(id.slice(7));
    if (!row) return null;
    const p = JSON.parse(row.profile);
    if (!p.biography) return null;
    return {
      id,
      parameters: parameters({
        country: p.country,
        type: p.type,
        city: p.fields.city,
        postalCode: p.fields.postalCode
      }),
      values: bioDefaults(p),
      revision: p.biographyRevision || 0,
      createdAt: p.createdAt || '',
      updatedAt: p.createdAt || '',
      sourceProfileId: p.id
    };
  }
  function record(id) {
    if (typeof id !== 'string' || !id || id.length > 160) return null;
    return store.get(`bio:record:${id}`) || legacy(id);
  }
  if (!store.get(KEY)) {
    const p = store.get('lastCard');
    const old = p?.biography ? legacy(`legacy:${p.id}`) : null;
    store.transaction(() =>
      store.set(KEY, {
        parameters: old?.parameters || {
          country: 'BR',
          city: 'São Paulo',
          postalCode: '',
          type: 'model'
        },
        parametersRevision: 0,
        recordId: old?.id || null
      })
    );
  }
  function read() {
    const config = store.get(KEY),
      current = record(config.recordId);
    return {
      ...config,
      record: current,
      institutions: current ? organizationOptions(asProfile(current.parameters)) : []
    };
  }
  const assertCurrent = (id, revision) => {
    const current = record(id);
    if (
      store.get(KEY).recordId !== id ||
      !current ||
      (revision !== undefined && (!Number.isSafeInteger(revision) || current.revision !== revision))
    )
      throw Error('STALE_BIO');
    return current;
  };
  return {
    read,
    configure({ revision, parameters: input }) {
      const p = parameters(input, true);
      return store.transaction(() => {
        const config = store.get(KEY);
        if (!Number.isSafeInteger(revision) || revision !== config.parametersRevision)
          throw Error('STALE_BIO_PARAMETERS');
        store.set(KEY, { ...config, parameters: p, parametersRevision: revision + 1 });
        return read();
      });
    },
    generate({ requestId, parameters: input }) {
      const p = parameters(input);
      if (typeof requestId !== 'string' || !requestId || requestId.length > 100)
        throw Error('INVALID_REQUEST');
      return store.transaction(() => {
        const previous = store.get(`bio:request:${requestId}`);
        if (previous) {
          if (JSON.stringify(previous.parameters) !== JSON.stringify(p))
            throw Error('REQUEST_CONFLICT');
          return previous.snapshot;
        }
        const config = store.get(KEY),
          now = new Date().toISOString();
        const current = {
          id: randomUUID(),
          parameters: p,
          values: bioSuggestions(asProfile(p), { store }),
          revision: 0,
          createdAt: now,
          updatedAt: now
        };
        store.set(`bio:record:${current.id}`, current);
        store.set(KEY, {
          parameters: p,
          parametersRevision: config.parametersRevision + 1,
          recordId: current.id
        });
        const snapshot = read();
        store.set(`bio:request:${requestId}`, { parameters: p, snapshot });
        return snapshot;
      });
    },
    save({ recordId, revision, values }) {
      validateBiographyValues(values);
      return store.transaction(() => {
        const current = assertCurrent(recordId, revision);
        const updated = {
          ...current,
          values: { ...values },
          revision: revision + 1,
          updatedAt: new Date().toISOString()
        };
        store.set(`bio:record:${recordId}`, updated);
        return updated;
      });
    },
    suggest({ recordId, field, values }) {
      const current = assertCurrent(recordId);
      validateBiographyValues(values);
      return bioSuggestions(asProfile(current.parameters), { store, field, values });
    },
    clear() {
      return store.transaction(() => {
        store.set(KEY, { ...store.get(KEY), recordId: null });
        return read();
      });
    },
    open(id) {
      return store.transaction(() => {
        const current = record(id);
        if (!current) throw Error('BIO_NOT_FOUND');
        const config = store.get(KEY);
        store.set(KEY, {
          ...config,
          parameters: current.parameters,
          parametersRevision: config.parametersRevision + 1,
          recordId: id
        });
        return read();
      });
    },
    history({ offset = 0, limit = 50 } = {}) {
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        throw Error('INVALID_PAGINATION');
      const query = `SELECT json_extract(value,'$.id') id, json_extract(value,'$.updatedAt') stamp FROM kv WHERE key GLOB 'bio:record:*'
        UNION ALL SELECT 'legacy:' || profile_id id, COALESCE(json_extract(profile,'$.createdAt'),'') stamp FROM requests
        WHERE json_type(profile,'$.biography')='object' AND NOT EXISTS(SELECT 1 FROM kv WHERE key='bio:record:legacy:' || requests.profile_id)`;
      const total = store.db.prepare(`SELECT COUNT(*) n FROM (${query})`).get().n;
      const items = store.db
        .prepare(`SELECT * FROM (${query}) ORDER BY stamp DESC,id LIMIT ? OFFSET ?`)
        .all(limit, offset)
        .map((row) => record(row.id));
      return { items, total, offset, limit };
    },
    cities(country) {
      if (!countries.includes(country)) throw Error('INVALID_BIO_PARAMETERS');
      const dataset =
        loadDataset(store, country) ||
        require(`../../../resources/generator/countries/${country}.json`);
      const options = [
        ...catalog
          .filter((row) => row.country === country)
          .map((row) => ({ city: row.city, postalCode: row.localityPostals?.[0] || '' })),
        ...dataset.places.map((row) => ({ city: row.city, postalCode: row.postal }))
      ];
      return [...new Map(options.map((row) => [JSON.stringify(row), row])).values()];
    }
  };
}
module.exports = { createBiographyWorkspace };
