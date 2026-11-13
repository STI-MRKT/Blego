const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('adjacent phone copy uses the profile country, preserves national zeros and never synthesizes a trunk prefix', async () => {
  const { nationalPhoneForCopy } = await import('../../src/js/utils/phone.mjs');
  const cases = [
    ['BR', '+55 (11) 98765-4321', '11987654321'],
    ['US', '+1 202 555 0199', '2025550199'],
    ['FR', '+33 6 00 00 00 01', '600000001'],
    ['PL', '+48 500 000 001', '500000001'],
    ['DE', '+49 151 23456789', '15123456789'],
    ['ES', '+34 600 000 001', '600000001'],
    ['IT', '+39 02 0012 0034', '0200120034'],
    ['GB', '+44 7700 900123', '7700900123']
  ];
  for (const [country, number, national] of cases) {
    assert.equal(nationalPhoneForCopy(number, country), national, country);
    const { LOCALES } = await import('../../src/js/data/locales.js');
    assert.equal(nationalPhoneForCopy(`${LOCALES[country].dial} 000123`, country), '000123');
  }
  for (const [number, country] of [
    ['+447700900123', 'US'],
    ['+12025550199', 'XX'],
    ['+1', 'US'],
    ['2025550199', 'US'],
    ['+1 202 ext99', 'US'],
    [null, 'BR']
  ])
    assert.throws(() => nationalPhoneForCopy(number, country));
});
test('address display order is address/city/postalCode for all 24 presets without changing saved field order or values', async () => {
  const { state } = await import('../../src/js/state.js'),
    { generatorHTML } = await import('../../src/js/ui/generator.js');
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'])
    for (const type of ['model', 'tech', 'crypto']) {
      const model = {
        country,
        type,
        createdAt: '2026-01-01T00:00:00Z',
        fields: {
          name: 'Synthetic',
          address: 'Street 1',
          city: 'City',
          postalCode: '00123',
          phone: '+12025550199'
        },
        fieldOrder: ['name', 'phone', 'postalCode', 'city', 'address']
      };
      state.demo = model;
      const before = JSON.stringify(model),
        html = generatorHTML();
      const order = [...html.matchAll(/data-field="(address|city|postalCode)"/g)].map((m) => m[1]);
      assert.deepEqual(order, ['address', 'city', 'postalCode'], `${country}/${type}`);
      assert.equal(JSON.stringify(model), before);
    }
});
