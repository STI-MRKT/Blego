const { test } = require('node:test');
const assert = require('node:assert/strict');
test('FP and BIO tabs are permanent, standalone BIO controls do not expose FP generation', async () => {
  const { state } = await import('../../src/js/state.js');
  const { generatorHTML } = await import('../../src/js/ui/generator.js');
  state.demo = null;
  state.generatorTab = 'profile';
  let html = generatorHTML();
  assert.match(html, /data-tab="profile"[^>]*>ФП</);
  assert.match(html, /data-tab="bio"/);
  state.generatorTab = 'bio';
  state.bio = { parameters: { country: 'GB', city: 'London', type: 'tech' }, record: null };
  html = generatorHTML();
  assert.match(html, /data-action="bio-generate"/);
  assert.match(html, /data-bio-param="city"/);
  assert.doesNotMatch(html, /data-action="generate"/);
  assert.doesNotMatch(html, /Профиль пока не создан/);
});
test('BIO clipboard model has only its own seven fields and preserves draft content', async () => {
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const model = copySource('biography', {
    id: 'bio',
    values: {
      residence: 'London',
      birthplace: '',
      employer: '',
      position: '',
      university: '',
      school: '',
      mainBio: '00 🧠'
    }
  });
  assert.equal(model.fields.length, 7);
  assert.equal(model.rows[0].values.mainBio, '00 🧠');
  assert.equal(model.rows[0].values.birthplace, '');
  assert.equal(model.rows[0].id, 'bio');
});
