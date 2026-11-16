const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ11 exact catalog adaptation separates names/cities, preserves unknown legacy labels and official city names', () => {
  const {
    separateBiography,
    styleBiography
  } = require('../../electron/features/generator/biography-values.cjs');
  const rows = [
    {
      id: 'official:nyu',
      kind: 'university',
      name: 'New York University',
      city: 'New York',
      country: 'US',
      region: 'New York',
      source: { url: 'https://www.nyu.edu/' }
    }
  ];
  for (const name of ['New York University', 'New York University — New York']) {
    const input = { university: name, mainBio: 'Original. Manual.' };
    const before = structuredClone(input);
    const result = separateBiography(input, 'US', rows);
    assert.equal(result.values.university, 'New York University');
    assert.equal(result.values.universityCity, 'New York');
    assert.equal(result.organizations.university.id, 'official:nyu');
    assert.equal(result.values.mainBio, input.mainBio);
    assert.deepEqual(input, before);
  }
  const unknown = separateBiography({ employer: 'Unconfirmed — Division — City' }, 'US', rows);
  assert.equal(unknown.values.employer, 'Unconfirmed — Division — City');
  assert.equal(unknown.values.employerCity, '');
  const manual = separateBiography(
    { university: 'New York University', universityCity: 'Manual city' },
    'US',
    rows
  );
  assert.equal(manual.values.universityCity, 'Manual city');
  assert.equal(manual.organizations.university, undefined);
  for (const type of ['model', 'tech', 'crypto']) {
    const text = styleBiography('First sentence. Second sentence.', type);
    assert.doesNotMatch(text, /\./);
    assert.match(text, /\p{Extended_Pictographic}/u);
    assert.match(text, /First sentence/);
  }
});
test('TZ11 city edits invalidate late organization and position suggestions as a pair', async () => {
  const { createBiographyEditor } = await import('../../src/js/services/biography.js');
  let resolve;
  const editor = createBiographyEditor(
    {
      recordId: 'id',
      revision: 0,
      values: { employer: 'Before', employerCity: 'Before city', position: 'Before role' }
    },
    { save: async (r) => ({ revision: r.revision + 1, values: r.values }), delay: 10000 }
  );
  const request = editor.suggest(
    'employer',
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  editor.update({ employerCity: 'Manual city' });
  resolve({ employer: 'After', employerCity: 'After city', position: 'After role' });
  assert.equal(await request, false);
  assert.equal(editor.values.employer, 'Before');
  assert.equal(editor.values.employerCity, 'Manual city');
  await editor.flush();
  editor.dispose();
});
