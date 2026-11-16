const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
const {
  createBiographyWorkspace
} = require('../../electron/features/generator/biography-workspace.cjs');
const catalog = require('../../resources/generator/institutions.json');
test('TZ11 BIO generates real organization pairs in eight countries, preserves provenance and independent saved manual values', async (t) => {
  const { store } = await fixture(t);
  const bio = createBiographyWorkspace({ store });
  const hubs = {
    BR: 'São Paulo',
    US: 'New York',
    FR: 'Paris',
    PL: 'Warszawa',
    DE: 'Berlin',
    ES: 'Madrid',
    IT: 'Milano',
    GB: 'London'
  };
  let record;
  for (const [country, city] of Object.entries(hubs))
    for (const type of ['model', 'tech', 'crypto']) {
      record = bio.generate({
        requestId: `${country}-${type}`,
        parameters: { country, city, type }
      }).record;
      for (const field of ['employer', 'university', 'school']) {
        if (!record.values[field]) {
          assert.equal(record.values[field + 'City'], '');
          continue;
        }
        const organization = catalog.find((row) => row.id === record.organizations[field].id);
        assert.equal(record.values[field], organization.name);
        assert.equal(record.values[field + 'City'], organization.city);
        assert.deepEqual(record.organizations[field].source, organization.source);
      }
      assert.doesNotMatch(record.values.mainBio, /\./);
      assert.match(record.values.mainBio, /\p{Extended_Pictographic}/u);
    }
  const patch = bio.suggest({ recordId: record.id, field: 'employer', values: record.values });
  assert.deepEqual(Object.keys(patch).sort(), ['employer', 'employerCity', 'position']);
  assert.equal(
    patch.employerCity,
    catalog.find((row) => row.name === patch.employer && row.country === 'GB').city
  );
  const saved = bio.save({
    recordId: record.id,
    revision: record.revision,
    values: { ...record.values, employerCity: 'Manual city', mainBio: 'Manual. Text.' }
  });
  const restarted = createBiographyWorkspace({ store }).read().record;
  assert.deepEqual(restarted, saved);
  assert.equal(restarted.values.mainBio, 'Manual. Text.');
  assert.equal(restarted.organizations.employer, undefined);
  assert.equal(store.get('lastCard'), undefined);
});
test('TZ11 old combined standalone rows are adapted on read without writes or duplicate history', async (t) => {
  const { store } = await fixture(t);
  const bio = createBiographyWorkspace({ store });
  const record = bio.generate({
    requestId: 'legacy',
    parameters: { country: 'US', city: 'New York', type: 'model' }
  }).record;
  const legacy = {
    ...record,
    values: {
      residence: 'NY',
      birthplace: 'NY',
      employer: 'Ralph Lauren Corporation — New York',
      position: 'Manual role',
      university: 'Columbia University — New York',
      school: 'Unconfirmed — School — Somewhere',
      mainBio: 'Legacy. Exact.'
    }
  };
  delete legacy.organizations;
  store.set('bio:record:' + record.id, legacy);
  for (let i = 0; i < 3; i++) {
    const read = bio.open(record.id).record;
    assert.equal(read.values.employer, 'Ralph Lauren Corporation');
    assert.equal(read.values.employerCity, 'New York');
    assert.equal(read.values.university, 'Columbia University');
    assert.equal(read.values.universityCity, 'New York');
    assert.equal(read.values.school, legacy.values.school);
    assert.equal(read.values.schoolCity, '');
    assert.equal(read.values.mainBio, legacy.values.mainBio);
    assert.deepEqual(store.get('bio:record:' + record.id), legacy);
  }
  assert.equal(bio.history().total, 1);
});
