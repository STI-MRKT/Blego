const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { openStore } = require('../../electron/local/store.cjs');
const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
const types = ['model', 'tech', 'crypto'];

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz12-data-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return store;
}

test('TZ12 new BIO and paired addresses are selected by production generation and survive reopening', async (t) => {
  let preset;
  // Control entropy only. Production filtering, reservation, serialization and SQLite all run.
  mock.method(crypto, 'randomInt', (max) => {
    const capacity =
      preset?.namingStrategy === 'brand_name'
        ? preset.brandNames.length
        : preset
          ? preset.first.length * preset.last.length + preset.personNames.length
          : 0;
    if (max === capacity)
      return preset.type === 'tech'
        ? 275 + countries.indexOf(preset.country)
        : preset.type === 'crypto'
          ? 40 + countries.indexOf(preset.country)
          : (preset.first.length - 1) * preset.last.length + preset.last.length - 1;
    return preset?.type === 'crypto' ? Math.min(max - 1, 40 + countries.indexOf(preset.country)) : max - 1;
  });
  const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
  delete require.cache[require.resolve('../../electron/features/generator/service.cjs')];
  const { generateProfile } = require('../../electron/features/generator/service.cjs');
  const store = await fixture(t);
  const results = [];
  for (const country of countries)
    for (const type of types) {
      preset = resolvePreset(country, type, { bulkMode: true, bulkConsent: true });
      const profile = await generateProfile(
        { country, type, requestId: `new-${country}-${type}` },
        { store, settings: { bulkMode: true, bulkConsent: true } }
      );
      const row = preset.addresses.find((candidate) =>
        candidate.address === profile.fields.address &&
        candidate.city === profile.fields.city &&
        candidate.postal === profile.fields.postal
      );
      assert.ok(row, 'Address, city and postal must belong to one synthetic tuple');
      assert.ok(
        preset.bios.some(
          (bio) =>
            require('../../electron/features/generator/biography.cjs').pageBio(bio, type) ===
            profile.fields.bio
        ),
        'BIO must come from its own localized pool'
      );
      assert.equal(profile.addressProvenance.kind, 'synthetic');
      assert.equal(profile.addressProvenance.datasetId, preset.addressDatasetId);
      assert.ok(profile.fields.email.endsWith('@dayrep.com'));
      assert.match(
        profile.fields.phone,
        new RegExp(`^\\+${preset.phonePrefix}\\d{${preset.phoneDigits}}$`)
      );
      if (type !== 'model') assert.ok(preset.brandNames.includes(profile.fields.name));
      else assert.ok(profile.fields.name.endsWith(' ' + preset.last.at(-1)));
      assert.equal(profile.nameGender, type === 'model' ? 'female' : null);
      results.push(profile);
    }
  assert.equal(new Set(results.map((p) => p.fields.phone)).size, results.length);
  assert.equal(new Set(results.map((p) => p.fields.email)).size, results.length);
  const reopened = await openStore(store.root);
  try {
    for (const profile of results) {
      const row = reopened.db
        .prepare('SELECT profile FROM requests WHERE request_id=?')
        .get(`new-${profile.country}-${profile.type}`);
      assert.deepEqual(JSON.parse(row.profile), profile);
    }
  } finally {
    reopened.close();
  }
  mock.restoreAll();
  for (const file of ['service', 'sources', 'naming'])
    delete require.cache[require.resolve(`../../electron/features/generator/${file}.cjs`)];
});

test(
  'TZ12 100 and 1000 profile runs preserve contacts, history and explicit bulk-mode rules; strict exhaustion stays finite',
  { timeout: 120000 },
  async (t) => {
    const { generateProfile } = require('../../electron/features/generator/service.cjs');
    const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
    const { nameCount } = require('../../electron/features/generator/naming.cjs');
    const store = await fixture(t);
    const profiles = [],
      timings = [],
      checkpoints = [];
    for (let i = 0; i < 1000; i++) {
      const country = countries[i % countries.length],
        type = types[Math.floor(i / countries.length) % types.length];
      const start = performance.now();
      const profile = await generateProfile(
        { country, type, requestId: `bulk-${i}` },
        { store, settings: { bulkMode: true, bulkConsent: true } }
      );
      timings.push(performance.now() - start);
      profiles.push(profile);
      for (const field of ['address', 'city', 'postalCode', 'bio', 'name'])
        assert.ok(profile.fields[field]);
      assert.ok(profile.fields.email.endsWith('@dayrep.com'));
      if (i === 99 || i === 999)
        checkpoints.push({ count: i + 1, elapsedMs: timings.reduce((a, b) => a + b, 0) });
    }
    for (const field of ['phone', 'email', 'handle', 'name'])
      assert.equal(new Set(profiles.map((p) => p.fields[field])).size, 1000, field);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n, 1000);
    const retry = await generateProfile(
      { country: 'BR', type: 'model', requestId: 'bulk-0' },
      { store, settings: { bulkMode: true, bulkConsent: true } }
    );
    assert.deepEqual(retry, profiles[0]);
    const strict = await fixture(t);
    let count = 0,
      error;
    try {
      for (; count < 100; count++)
        await generateProfile(
          { country: 'GB', type: 'model', requestId: `strict-${count}` },
          { store: strict, settings: {} }
        );
    } catch (caught) {
      error = caught;
    }
    assert.equal(error?.code, 'POOL_EXHAUSTED');
    assert.equal(
      count,
      6,
      'GB still has six unique postal values; address examples do not bypass exhaustion'
    );
    assert.equal(strict.db.prepare('SELECT COUNT(*) AS n FROM requests').get().n, count);
    const sorted = [...timings].sort((a, b) => a - b);
    const result = {
      checkpoints,
      uniqueContacts: 1000,
      strictProfiles: count,
      strictError: error.code,
      p50Ms: sorted[500],
      p95Ms: sorted[950],
      maxMs: sorted.at(-1),
      nameCapacity: nameCount(resolvePreset('GB', 'model'))
    };
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      fs.writeFileSync(
        path.join(process.env.BLEGO_CAPTURE, 'tz12-generation.json'),
        JSON.stringify(result, null, 2) + '\n'
      );
    }
    t.diagnostic(JSON.stringify(result));
  }
);
