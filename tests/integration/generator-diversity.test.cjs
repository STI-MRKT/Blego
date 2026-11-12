const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
test('24 localized thematic presets retain contacts, paired geography and sufficient authored templates', () => {
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB']) {
    const distinct = new Set();
    for (const type of ['model', 'tech', 'crypto']) {
      const p = resolvePreset(country, type);
      assert.ok(p.bios.length >= 30);
      assert.ok(p.statuses.length >= 20);
      assert.equal(new Set(p.bios).size, p.bios.length);
      assert.equal(new Set(p.statuses).size, p.statuses.length);
      distinct.add(p.bios[0]);
    }
    assert.equal(distinct.size, 3);
  }
});
test('transliteration preserves displayed accents and phone/postal exhaustion does not spend contacts', async (t) => {
  const { transliterate } = require('../../electron/features/generator/sources.cjs');
  assert.equal(transliterate('Łucía Weiß Œuf'), 'lucia-weiss-oeuf');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-diversity-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const settings = { allowRepeats: ['bio', 'status', 'address'] };
  const p = resolvePreset('PL', 'model', settings);
  for (let i = 0; i < 4; i++) {
    const card = await generateProfile(
      { country: 'PL', type: 'model', requestId: String(i) },
      { store, settings }
    );
    assert.equal(card.transliterationVersion, 'latin-v1');
    assert.ok(
      p.places.some(
        (place) => place.city === card.fields.city && place.postal === card.fields.postalCode
      )
    );
    assert.match(card.fields.email, /^[a-z0-9.\-]+@example\.(com|net|org)$/);
    assert.ok(card.fields.handle.length <= 64);
  }
  const count = store.db.prepare('SELECT count(*) n FROM issued').get().n;
  await assert.rejects(
    generateProfile({ country: 'PL', type: 'model', requestId: 'exhausted' }, { store, settings }),
    (error) => error.code === 'POOL_EXHAUSTED' && error.details.field === 'postalCode'
  );
  assert.equal(store.db.prepare('SELECT count(*) n FROM issued').get().n, count);
});
