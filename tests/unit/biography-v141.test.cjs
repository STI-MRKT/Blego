const { test } = require('node:test');
const assert = require('node:assert/strict');
test('BIO autosave keeps inputs editable, removes Save/unsaved banner and offers each field regeneration', async () => {
  const { state } = await import('../../src/js/state.js');
  const { biographyHTML } = await import('../../src/js/ui/biography.js');
  state.demo = null;
  state.bio = {
    parameters: { country: 'GB', city: 'London', type: 'model' },
    record: { id: 'test' }
  };
  state.bioEditor = {
    recordId: 'test',
    values: {
      residence: 'x',
      birthplace: '',
      employer: '',
      position: '',
      university: '',
      school: '',
      mainBio: ''
    },
    institutions: [],
    saving: true,
    dirty: true
  };
  const html = biographyHTML();
  const controls = html.match(/<(?:input|textarea|select)\b[^>]*>/g);
  assert.equal(controls.length, 12);
  for (const control of controls) assert.doesNotMatch(control, /\bdisabled\b/);
  assert.doesNotMatch(html, /bio-save|Сохранить BIO|Есть несохранённые изменения/);
  assert.equal((html.match(/data-action="bio-regenerate"/g) || []).length, 7);
  assert.equal((html.match(/data-action="bio-copy"/g) || []).length, 7);
  assert.match(html, /Сохраняем/);
});
