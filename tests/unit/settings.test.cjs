const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSettings } = require('../../electron/local/settings.cjs');
test('settings reject unknown and invalid values', () => {
  assert.throws(() => validateSettings({ country: 'XX' }));
  assert.throws(() => validateSettings({ newsEnabled: 'yes' }));
  assert.throws(() => validateSettings({ password: 'secret' }));
  assert.deepEqual(validateSettings({ country: 'GB', symbols: '★' }), {
    country: 'GB',
    symbols: '★'
  });
});
