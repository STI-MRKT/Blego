const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
test('TZ06 BIO explicit edit persists with profile and history without spending contacts or changing legacy fields', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const p = await generateProfile({ requestId: 'bio', country: 'IT', type: 'tech' }, { store });
  const {
    bioDefaults,
    saveBiography,
    bioSuggestions
  } = require('../../electron/features/generator/biography.cjs');
  const defaults = bioDefaults(p);
  assert.equal(defaults.residence, `${p.fields.city}, Italy`);
  assert.equal(defaults.birthplace, defaults.residence);
  const original = JSON.stringify(p.fields),
    issued = store.db.prepare('SELECT COUNT(*) n FROM issued').get().n;
  const b = {
    ...defaults,
    birthplace: 'Rome, Italy',
    mainBio: 'Synthetic text 🧠',
    university: 'Manual university'
  };
  const saved = saveBiography({ profileId: p.id, revision: 0, values: b }, { store });
  assert.equal(saved.biography.birthplace, 'Rome, Italy');
  assert.equal(saved.biography.residence, defaults.residence);
  assert.equal(JSON.stringify(saved.fields), original);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, issued);
  assert.throws(
    () => saveBiography({ profileId: p.id, revision: 0, values: b }, { store }),
    /STALE/
  );
  const suggest = bioSuggestions(p, { store });
  assert.ok(suggest.mainBio);
  assert.ok(suggest.employer && suggest.position);
  store.close();
  store = await openStore(root);
  assert.deepEqual(store.get('lastCard').biography, b);
  assert.deepEqual(
    JSON.parse(
      store.db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(p.id).profile
    ).biography,
    b
  );
  assert.deepEqual(
    (await generateProfile({ requestId: 'bio', country: 'IT', type: 'tech' }, { store })).biography,
    b
  );
});
