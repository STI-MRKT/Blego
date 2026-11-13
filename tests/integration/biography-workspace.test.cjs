const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile, clearCard } = require('../../electron/features/generator/service.cjs');
const {
  createBiographyWorkspace
} = require('../../electron/features/generator/biography-workspace.cjs');
async function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-workspace-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { store, root, bio: createBiographyWorkspace({ store }) };
}
const london = { country: 'GB', city: 'London', postalCode: 'EC1A 1BB', type: 'tech' };
test('standalone BIO works with no FP and never spends profile contacts or creates FP history', async (t) => {
  const { store, bio } = await setup(t);
  assert.equal(bio.read().record, null);
  const result = bio.generate({ requestId: 'bio-alone', parameters: london });
  assert.equal(store.get('lastCard'), undefined);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM requests').get().n, 0);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM issued').get().n, 0);
  assert.equal(result.record.values.residence, 'London, United Kingdom');
  assert.equal(result.record.values.birthplace, 'London, United Kingdom');
  assert.ok(result.record.values.employer.includes('Revolut'));
  assert.ok(result.record.values.position);
  assert.ok(result.record.values.university);
  assert.ok(result.record.values.school);
  assert.ok(result.record.values.mainBio);
  assert.deepEqual(bio.generate({ requestId: 'bio-alone', parameters: london }), result);
  assert.throws(
    () => bio.generate({ requestId: 'bio-alone', parameters: { ...london, type: 'model' } }),
    /REQUEST_CONFLICT/
  );
});
test('FP generation/clear and BIO generation/save/clear cannot overwrite the other workspace', async (t) => {
  const { store, bio } = await setup(t);
  const first = bio.generate({ requestId: 'first-bio', parameters: london }).record;
  const p = await generateProfile({ requestId: 'fp-1', country: 'GB', type: 'model' }, { store });
  assert.deepEqual(bio.read().record, first);
  const values = { ...first.values, mainBio: 'Independent manual BIO' };
  const saved = bio.save({ recordId: first.id, revision: first.revision, values });
  assert.deepEqual(store.get('lastCard'), p);
  assert.equal(bio.read().record.values.mainBio, 'Independent manual BIO');
  clearCard(store);
  assert.deepEqual(bio.read().record, saved);
  const p2 = await generateProfile({ requestId: 'fp-2', country: 'IT', type: 'tech' }, { store });
  const before = store.db
    .prepare('SELECT profile FROM requests WHERE profile_id=?')
    .get(p2.id).profile;
  const next = bio.generate({
    requestId: 'next-bio',
    parameters: { ...london, type: 'model' }
  }).record;
  assert.notEqual(next.id, first.id);
  assert.notEqual(next.id, p2.id);
  assert.equal(
    store.db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(p2.id).profile,
    before
  );
  bio.clear();
  assert.equal(bio.read().record, null);
  assert.deepEqual(store.get('lastCard'), p2);
  assert.equal(bio.history().items.filter((item) => !item.sourceProfileId).length, 2);
  assert.equal(bio.open(first.id).record.values.mainBio, 'Independent manual BIO');
});
test('BIO parameter and value revisions reject stale writes and preserve other generator settings', async (t) => {
  const { store, bio } = await setup(t);
  store.set('settings', { country: 'BR', type: 'model' });
  const initial = bio.read();
  const config = bio.configure({ revision: initial.parametersRevision, parameters: london });
  assert.deepEqual(config.parameters, london);
  assert.deepEqual(store.get('settings'), { country: 'BR', type: 'model' });
  assert.throws(
    () => bio.configure({ revision: initial.parametersRevision, parameters: london }),
    /STALE_BIO_PARAMETERS/
  );
  const generated = bio.generate({ requestId: 'revision', parameters: london }).record;
  bio.save({
    recordId: generated.id,
    revision: 0,
    values: { ...generated.values, mainBio: 'edit' }
  });
  assert.throws(
    () => bio.save({ recordId: generated.id, revision: 0, values: generated.values }),
    /STALE_BIO/
  );
  bio.clear();
  assert.throws(
    () => bio.save({ recordId: generated.id, revision: 1, values: generated.values }),
    /STALE_BIO/
  );
  assert.throws(
    () => bio.generate({ requestId: 'bad', parameters: { ...london, country: 'XX' } }),
    /INVALID_BIO_PARAMETERS/
  );
  assert.throws(
    () => bio.generate({ requestId: 'bad', parameters: { ...london, city: '' } }),
    /INVALID_BIO_PARAMETERS/
  );
});
test('legacy BIO opens without duplicate records, preserves original FP JSON, and remains available after clear and restart', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-legacy-bio-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const p = await generateProfile({ requestId: 'legacy', country: 'GB', type: 'model' }, { store });
  p.biography = {
    residence: 'Old residence',
    birthplace: '',
    employer: 'Manual old company',
    position: 'Old role',
    university: '',
    school: 'Manual school',
    mainBio: 'Legacy BIO 00 🧠'
  };
  p.biographyRevision = 7;
  store.set('lastCard', p);
  store.db.prepare('UPDATE requests SET profile=? WHERE profile_id=?').run(JSON.stringify(p), p.id);
  const original = store.db
    .prepare('SELECT profile FROM requests WHERE profile_id=?')
    .get(p.id).profile;
  let bio = createBiographyWorkspace({ store });
  const legacy = bio.read().record;
  assert.notEqual(legacy.id, p.id);
  assert.deepEqual(legacy.values, p.biography);
  for (let i = 0; i < 3; i++) bio.open(legacy.id);
  assert.equal(
    store.db.prepare("SELECT COUNT(*) n FROM kv WHERE key GLOB 'bio:record:*'").get().n,
    0
  );
  assert.equal(bio.history().total, 1);
  const updated = bio.save({
    recordId: legacy.id,
    revision: 7,
    values: { ...legacy.values, mainBio: 'Independent edit' }
  });
  assert.equal(
    store.db.prepare('SELECT profile FROM requests WHERE profile_id=?').get(p.id).profile,
    original
  );
  assert.deepEqual(store.get('lastCard'), p);
  for (let i = 0; i < 3; i++) bio.open(legacy.id);
  assert.equal(
    store.db.prepare("SELECT COUNT(*) n FROM kv WHERE key GLOB 'bio:record:*'").get().n,
    1
  );
  assert.equal(bio.history().total, 1);
  store.close();
  store = await openStore(root);
  bio = createBiographyWorkspace({ store });
  assert.deepEqual(bio.read().record, updated);
  bio.clear();
  store.close();
  store = await openStore(root);
  bio = createBiographyWorkspace({ store });
  assert.equal(bio.read().record, null);
  assert.equal(bio.open(legacy.id).record.values.mainBio, 'Independent edit');
});
test('failed BIO transactions roll back record, current pointer, request marker and parameters', async (t) => {
  const { store, bio } = await setup(t);
  const initial = bio.read();
  const set = store.set.bind(store);
  store.set = (key, value) => {
    if (key === 'bio:workspace') throw Error('SQLITE_FULL');
    return set(key, value);
  };
  assert.throws(() => bio.generate({ requestId: 'rollback', parameters: london }), /SQLITE_FULL/);
  assert.deepEqual(bio.read(), initial);
  assert.equal(
    store.db
      .prepare(
        "SELECT COUNT(*) n FROM kv WHERE key GLOB 'bio:record:*' OR key GLOB 'bio:request:*'"
      )
      .get().n,
    0
  );
  store.set = set;
  const p = bio.generate({ requestId: 'rollback', parameters: london }).record;
  store.set = (key, value) => {
    if (key.startsWith('bio:record:')) throw Error('SQLITE_FULL');
    return set(key, value);
  };
  assert.throws(
    () => bio.save({ recordId: p.id, revision: 0, values: { ...p.values, mainBio: 'failed' } }),
    /SQLITE_FULL/
  );
  assert.deepEqual(bio.read().record, p);
});
test('BIO history pagination and suggestions use saved geography despite new control parameters', async (t) => {
  const { bio, store } = await setup(t);
  const first = bio.generate({ requestId: 'history-first', parameters: london }).record;
  const config = bio.read();
  bio.configure({
    revision: config.parametersRevision,
    parameters: { country: 'BR', city: 'Unknown small town', postalCode: '', type: 'model' }
  });
  assert.deepEqual(bio.suggest({ recordId: first.id, field: 'residence', values: first.values }), {
    residence: 'London, United Kingdom'
  });
  assert.equal(createBiographyWorkspace({ store }).read().parameters.city, 'Unknown small town');
  const second = bio.generate({
    requestId: 'history-second',
    parameters: bio.read().parameters
  }).record;
  for (const key of ['employer', 'position', 'university', 'school'])
    assert.equal(second.values[key], '');
  const page = bio.history({ limit: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  assert.notEqual(bio.history({ offset: 1, limit: 1 }).items[0].id, page.items[0].id);
  assert.throws(() => bio.history({ limit: 101 }), /INVALID_PAGINATION/);
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'])
    assert.ok(bio.cities(country).length);
});
