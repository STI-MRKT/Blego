const { randomInt, randomUUID } = require('node:crypto');
const path = require('node:path');
const { normalize } = require('./registry.cjs');
const supplement = require('../../../resources/generator/supplements/names-v14.json');
const initializing = new WeakMap();
function namingPreset(country, type, dataset) {
  const brand = type === 'tech';
  // Imported country dictionaries remain authoritative for personal names.
  const personNames = brand
    ? []
    : supplement.personNames[type][country].filter((name) =>
        dataset.first.some(
          (first) =>
            name.startsWith(first + ' ') && !dataset.last.includes(name.slice(first.length + 1))
        )
      );
  return {
    namingStrategy: brand ? 'brand_name' : 'person_name',
    nameGender: brand ? null : 'female',
    namingDatasetId: supplement.id,
    brandNames: brand ? supplement.brandNames : [],
    personNames
  };
}
function nameCount(p) {
  return p.namingStrategy === 'brand_name'
    ? p.brandNames.length
    : p.first.length * p.last.length + p.personNames.length;
}
function nameAt(p, index) {
  if (p.namingStrategy === 'brand_name') return p.brandNames[index];
  const base = p.first.length * p.last.length;
  return index < base
    ? `${p.first[Math.floor(index / p.last.length)]} ${p.last[index % p.last.length]}`
    : p.personNames[index - base];
}
function selectName(p, used) {
  const count = nameCount(p),
    start = randomInt(count);
  // Random starting index followed by bounded search; no million-name array.
  for (let offset = 0; offset < Math.min(count, used.size + 1); offset++) {
    const name = nameAt(p, (start + offset) % count);
    if (p.allowRepeats.includes('name') || !used.has(normalize('name', name))) return name;
  }
  return null;
}
async function ensureNameRegistry(store) {
  if (store.get('generator:names-index-v1')) return;
  if (initializing.has(store)) return initializing.get(store);
  const task = (async () => {
    if (store.db.prepare('SELECT 1 FROM requests LIMIT 1').get())
      await store.backup(path.join(store.root, `generator-names-${randomUUID()}.backup`));
    store.transaction(() => {
      const insert = store.db.prepare('INSERT OR IGNORE INTO issued VALUES(?,?,?,?)');
      for (const row of store.db.prepare('SELECT profile FROM requests').iterate()) {
        const profile = JSON.parse(row.profile);
        if (typeof profile.fields?.name === 'string' && profile.fields.name.trim())
          insert.run('name', 'installation', normalize('name', profile.fields.name), profile.id);
      }
      store.set('generator:names-index-v1', true);
    });
  })();
  initializing.set(store, task);
  try {
    await task;
  } finally {
    initializing.delete(store);
  }
}
function usedNames(store) {
  const names = new Set(
    store.db
      .prepare("SELECT value FROM issued WHERE field='name' AND scope='installation'")
      .all()
      .map((row) => row.value)
  );
  if (!store.get('generator:names-index-v1'))
    for (const row of store.db.prepare('SELECT profile FROM requests').iterate()) {
      const name = JSON.parse(row.profile).fields?.name;
      if (typeof name === 'string') names.add(normalize('name', name));
    }
  return names;
}
function isPossibleName(p, name) {
  if (p.namingStrategy === 'brand_name')
    return p.brandNames.some((x) => normalize('name', x) === name);
  if (p.personNames.some((x) => normalize('name', x) === name)) return true;
  return p.first.some(
    (first) =>
      name.startsWith(normalize('name', first) + ' ') &&
      p.last.some((last) => normalize('name', `${first} ${last}`) === name)
  );
}
module.exports = {
  namingPreset,
  nameCount,
  nameAt,
  selectName,
  ensureNameRegistry,
  usedNames,
  isPossibleName
};
