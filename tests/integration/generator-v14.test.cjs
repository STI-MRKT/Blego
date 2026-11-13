const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
const { getPoolStats } = require('../../electron/features/generator/catalog.cjs');
const bulk = { bulkMode: true, bulkConsent: true };
async function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-v14-names-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    async reopen() {
      store.close();
      store = await openStore(root);
    },
    root
  };
}
test('TECH finite brands exhaust across countries and restart; explicit repeats still reserve unique dayrep emails', async (t) => {
  const env = await setup(t),
    p = resolvePreset('US', 'tech', bulk);
  assert.equal(p.namingStrategy, 'brand_name');
  assert.ok(p.brandNames.length >= 225 && p.brandNames.length <= 325);
  const names = new Set(),
    emails = new Set();
  for (let i = 0; i < p.brandNames.length; i++) {
    if (i === 100) await env.reopen();
    const card = await generateProfile(
      { country: i % 2 ? 'US' : 'GB', type: 'tech', requestId: `brand-${i}` },
      { store: env.store, settings: bulk }
    );
    assert.equal(card.namingStrategy, 'brand_name');
    assert.equal(card.nameGender, null);
    assert.ok(p.brandNames.includes(card.fields.name));
    assert.match(card.fields.email, /^[a-z0-9.]+@dayrep\.com$/);
    assert.ok(card.fields.email.split('@')[0].length <= 64);
    names.add(card.fields.name);
    emails.add(card.fields.email);
  }
  assert.equal(names.size, p.brandNames.length);
  const before = env.store.db.prepare('SELECT COUNT(*) n FROM issued').get().n;
  await assert.rejects(
    generateProfile(
      { country: 'FR', type: 'tech', requestId: 'exhausted' },
      { store: env.store, settings: bulk }
    ),
    (e) => e.code === 'POOL_EXHAUSTED' && e.details.field === 'name'
  );
  assert.equal(env.store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, before);
  assert.equal(
    getPoolStats({ country: 'US', type: 'tech' }, { store: env.store, settings: bulk }).capacities
      .nameCombinations.available,
    0
  );
  const repeated = await generateProfile(
    { country: 'US', type: 'tech', requestId: 'repeat' },
    { store: env.store, settings: { ...bulk, allowRepeats: ['name'] } }
  );
  assert.ok(names.has(repeated.fields.name));
  assert.ok(!emails.has(repeated.fields.email));
});
test('historical and explicitly imported emails remain unchanged; old names enter registry without rewriting history', async (t) => {
  const env = await setup(t),
    store = env.store;
  const legacy = {
    id: 'old-brand',
    country: 'US',
    type: 'tech',
    fields: { name: 'Future Hub', email: 'old@example.org' }
  };
  store.db
    .prepare('INSERT INTO requests VALUES(?,?,?)')
    .run('legacy', legacy.id, JSON.stringify(legacy));
  assert.deepEqual(
    await generateProfile({ country: 'US', type: 'tech', requestId: 'legacy' }, { store }),
    legacy
  );
  const card = await generateProfile(
    { country: 'US', type: 'tech', requestId: 'new' },
    { store, settings: bulk }
  );
  assert.notEqual(card.fields.name, legacy.fields.name);
  assert.equal(
    JSON.parse(
      store.db.prepare('SELECT profile FROM requests WHERE request_id=?').get('legacy').profile
    ).fields.email,
    'old@example.org'
  );
  assert.ok(
    store.db.prepare("SELECT 1 FROM issued WHERE field='name' AND value='future hub'").get()
  );
  assert.ok(
    fs.readdirSync(env.root).some((n) => n.startsWith('generator-names-') && n.endsWith('.backup'))
  );
  const imported = await generateProfile(
    { country: 'US', type: 'tech', requestId: 'custom' },
    {
      store,
      settings: {
        ...bulk,
        overrides: {
          types: {
            tech: {
              pool: [
                {
                  name: 'Custom Robotics Journal',
                  phone: '+12029998888',
                  email: 'explicit@example.net',
                  handle: 'explicit.fixture'
                }
              ]
            }
          }
        }
      }
    }
  );
  assert.equal(imported.fields.email, 'explicit@example.net');
  assert.equal(imported.fields.name, 'Custom Robotics Journal');
});

test('localized BIOs exhaust without spending contacts and persist exactly across restart', async (t) => {
  const env = await setup(t);
  const settings = { allowRepeats: ['name', 'status', 'postalCode', 'address', 'number'] };
  const preset = resolvePreset('FR', 'model', settings),
    texts = new Set();
  assert.ok(preset.bios.length >= 80);
  for (let i = 0; i < preset.bios.length; i++) {
    if (i === 40) await env.reopen();
    const card = await generateProfile(
      { country: 'FR', type: 'model', requestId: `bio-${i}` },
      { store: env.store, settings }
    );
    texts.add(card.fields.bio);
    assert.equal(card.bioDatasetId, preset.bioDatasetId);
  }
  assert.equal(texts.size, preset.bios.length);
  const count = env.store.db.prepare('SELECT COUNT(*) n FROM issued').get().n;
  await assert.rejects(
    generateProfile(
      { country: 'FR', type: 'model', requestId: 'no-bio' },
      { store: env.store, settings }
    ),
    (e) => e.code === 'POOL_EXHAUSTED' && e.details.field === 'bio'
  );
  assert.equal(env.store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, count);
  const original = JSON.parse(
    env.store.db.prepare("SELECT profile FROM requests WHERE request_id='bio-0'").get().profile
  );
  assert.deepEqual(
    await generateProfile(
      { country: 'FR', type: 'model', requestId: 'bio-0' },
      {
        store: env.store,
        settings: { ...settings, overrides: { common: { bios: ['Changed later'] } } }
      }
    ),
    original
  );
});
test('unusable backup aborts historical name indexing without altering the original store', async (t) => {
  const env = await setup(t),
    store = env.store;
  const old = {
    id: 'legacy',
    country: 'US',
    type: 'model',
    fields: { name: 'Alice Example', email: 'old@example.org' }
  };
  store.db.prepare('INSERT INTO requests VALUES(?,?,?)').run('legacy', old.id, JSON.stringify(old));
  store.backup = async (destination) => fs.writeFileSync(destination, 'not a database');
  await assert.rejects(
    generateProfile({ country: 'US', type: 'model', requestId: 'new' }, { store }),
    /GENERATOR_BACKUP_INVALID/
  );
  assert.equal(store.get('generator:names-index-v1'), undefined);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, 0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM requests').get().n, 1);
});
