const { test } = require('node:test');
const assert = require('node:assert/strict');
test('BIO fields cannot be changed while an asynchronous save or suggestion is pending', async () => {
  const { state } = await import('../../src/js/state.js');
  const { biographyHTML } = await import('../../src/js/ui/biography.js');
  state.demo = { id: 'test' };
  state.bioEditor = {
    profileId: 'test',
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
  assert.equal(controls.length, 9);
  for (const control of controls) assert.match(control, /\bdisabled\b/);
  for (const control of html.match(/<button[^>]*data-action="bio-(?:work|generate)"[^>]*>/g))
    assert.match(control, /\bdisabled\b/);
});
