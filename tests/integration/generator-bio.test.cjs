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
  // Explicit legacy fixture: old attached BIO must remain compatible.
  p.biography = { ...bioDefaults(p), birthplace: '' };
  store.set('lastCard', p);
  store.db.prepare('UPDATE requests SET profile=? WHERE profile_id=?').run(JSON.stringify(p), p.id);
  const defaults = bioDefaults(p);
  assert.equal(defaults.residence, `${p.fields.city}, Italy`);
  assert.equal(defaults.birthplace, ''); // Brand pages do not have a personal birthplace.
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
  assert.equal(suggest.employer, ''); // Tech is a project/brand, not a person.
  assert.equal(suggest.position, '');
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
test('FP commits atomically without creating attached BIO; legacy writes still roll back on error', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-initial-bio-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const request = { requestId: 'auto-bio', country: 'GB', type: 'model' };
  const p = await generateProfile(request, { store });
  assert.equal(p.biography, undefined);
  assert.ok(p.fields.bio);
  assert.deepEqual(store.get('lastCard'), p);
  assert.deepEqual(
    JSON.parse(
      store.db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(p.id).profile
    ),
    p
  );
  assert.deepEqual(await generateProfile(request, { store }), p);
  const before = store.db.prepare('SELECT COUNT(*) n FROM issued').get().n;
  const set = store.set.bind(store);
  store.set = (key, value) => {
    if (key === 'lastCard') throw Error('SQLITE_FULL');
    return set(key, value);
  };
  await assert.rejects(
    generateProfile({ ...request, requestId: 'failed-bio' }, { store }),
    /SQLITE_FULL/
  );
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, before);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM requests').get().n, 1);
  assert.deepEqual(store.get('lastCard'), p);
  const { saveBiography } = require('../../electron/features/generator/biography.cjs');
  assert.throws(
    () =>
      saveBiography(
        {
          profileId: p.id,
          revision: 0,
          values: {
            ...require('../../electron/features/generator/biography.cjs').bioDefaults(p),
            mainBio: 'new draft'
          }
        },
        { store }
      ),
    /SQLITE_FULL/
  );
  assert.deepEqual(
    JSON.parse(
      store.db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(p.id).profile
    ),
    p
  );
});
