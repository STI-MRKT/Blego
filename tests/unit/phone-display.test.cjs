const { test } = require('node:test');
const assert = require('node:assert/strict');

test('generated synthetic phones display consistently as XXX-XXX-XXXX without changing source', async () => {
  const { formatPhoneDisplay } = await import('../../src/js/utils/phone.mjs');
  const cases = [
    ['BR', '+5511900000000', '190-000-0000'],
    ['US', '+12020000000', '202-000-0000'],
    ['FR', '+33600000000', '060-000-0000'],
    ['PL', '+48500000000', '050-000-0000'],
    ['DE', '+491510000000', '151-000-0000'],
    ['ES', '+34600000000', '060-000-0000'],
    ['IT', '+393000000000', '300-000-0000'],
    ['GB', '+447700000000', '770-000-0000']
  ];
  for (const [country, original, expected] of cases) {
    const before = original;
    const visual = formatPhoneDisplay(original, country);
    assert.equal(visual, expected, country);
    assert.match(visual, /^[0-9]{3}-[0-9]{3}-[0-9]{4}$/);
    assert.equal(original, before, 'Persisted canonical E.164 source is unchanged');
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
