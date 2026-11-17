const { test } = require('node:test');
const assert = require('node:assert/strict');

test('generated phone values follow country-specific FNG layout while canonical E164 remains unchanged', async () => {
  const { formatPhoneDisplay } = await import('../../src/js/utils/phone.mjs');
  const cases = [
    ['BR', '+5511900000000', '(11) 90000-0000'],
    ['US', '+12020000000', '202-000-0000'],
    ['FR', '+33600000000', '06 00 00 00 00'],
    ['PL', '+48500000000', '50 000 00 00'],
    ['DE', '+491510000000', '0151 000 0000'],
    ['ES', '+34600000000', '600 000 000'],
    ['IT', '+393000000000', '300 000 0000'],
    ['GB', '+447700000000', '07700 000000']
  ];
  for (const [country, original, expected] of cases) {
    const visual = formatPhoneDisplay(original, country);
    assert.equal(visual, expected, country);
    assert.ok(/^[0-9 ()-]+$/.test(visual));
  }
});

test('unknown or noncanonical phone strings are preserved exactly', async () => {
  const { formatPhoneDisplay } = await import('../../src/js/utils/phone.mjs');
  assert.equal(formatPhoneDisplay('+44 (7700) 900-123', 'GB'), '+44 (7700) 900-123');
  assert.equal(formatPhoneDisplay('+12020000000', 'BR'), '+12020000000');
  assert.equal(formatPhoneDisplay('001234', 'US'), '001234');
  assert.equal(formatPhoneDisplay('', 'US'), '');
  assert.equal(formatPhoneDisplay(null, 'US'), '');
});
