const { test } = require('node:test');
const assert = require('node:assert/strict');

test('generated phone values display in human-readable country groups without changing their digits', async () => {
  const { formatPhoneDisplay } = await import('../../shared/phone-display.mjs');
  const cases = [
    ['BR', '+5511900000000', '+55 (11) 90000-0000'],
    ['US', '+12020000000', '+1 (202) 000-0000'],
    ['FR', '+33600000000', '+33 6 00 00 00 00'],
    ['PL', '+48500000000', '+48 500 000 000'],
    ['DE', '+491510000000', '+49 151 0000 000'],
    ['ES', '+34600000000', '+34 600 000 000'],
    ['IT', '+393000000000', '+39 300 000 0000'],
    ['GB', '+447700000000', '+44 7700 000000']
  ];
  for (const [country, original, expected] of cases) {
    const visual = formatPhoneDisplay(original, country);
    assert.equal(visual, expected, country);
    assert.equal(visual.replace(/[^\d]/g, ''), original.slice(1));
  }
});

test('unknown or noncanonical phone strings are preserved exactly', async () => {
  const { formatPhoneDisplay } = await import('../../shared/phone-display.mjs');
  assert.equal(formatPhoneDisplay('+44 (7700) 900-123', 'GB'), '+44 (7700) 900-123');
  assert.equal(formatPhoneDisplay('+12020000000', 'BR'), '+12020000000');
  assert.equal(formatPhoneDisplay('001234', 'US'), '001234');
  assert.equal(formatPhoneDisplay('', 'US'), '');
  assert.equal(formatPhoneDisplay(null, 'US'), '');
});
