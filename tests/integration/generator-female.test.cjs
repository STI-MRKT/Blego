const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');

test('female personal / brand strategies cover 24 presets, preserves old cards and rejects incompatible custom pools', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-female-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const old = {
    id: 'old-fixture',
    country: 'US',
    type: 'model',
    fields: { name: 'Legacy male fixture' },
    createdAt: '2026-01-01T00:00:00.000Z'
  };
  store.db
    .prepare('INSERT INTO requests VALUES(?,?,?)')
    .run('old', 'old-fixture', JSON.stringify(old));
  assert.deepEqual(
    await generateProfile({ country: 'US', type: 'model', requestId: 'old' }, { store }),
    old
  );
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'])
    for (const type of ['model', 'tech', 'crypto']) {
      const preset = resolvePreset(country, type);
      const card = await generateProfile(
        { country, type, requestId: `${country}-${type}` },
        { store }
      );
      assert.equal(card.nameGender, type === 'tech' ? null : 'female');
      if (type === 'tech') assert.ok(preset.brandNames.includes(card.fields.name));
      else assert.ok(preset.first.some((name) => card.fields.name.startsWith(name + ' ')));
      assert.equal(card.datasetVersion, preset.datasetVersion);
      assert.ok(card.fields.email && card.fields.phone);
    }
  const before = store.db.prepare('SELECT COUNT(*) n FROM issued').get().n;
  await assert.rejects(
    generateProfile(
      { country: 'US', type: 'model', requestId: 'bad-pool' },
      {
        store,
        settings: {
          overrides: {
            common: {
              pool: [
                {
                  name: 'Michael Example',
                  email: 'fixture@example.net',
                  phone: '+12029999999',
                  handle: 'fixture.male'
                }
              ]
            }
          }
        }
      }
    ),
    { message: 'POOL_NAME_NOT_FEMALE' }
  );
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, before);
});
