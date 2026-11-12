const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
test('all 24 country/type presets are complete and thematic', () => {
  for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB']) {
    const seen = new Set();
    for (const type of ['model', 'tech', 'crypto']) {
      const p = resolvePreset(country, type);
      assert.ok(p.phonePrefix);
      assert.ok(p.bios.length);
      assert.ok(p.fieldOrder.includes('phone'));
      assert.ok(p.fieldOrder.includes('email'));
      seen.add(p.bios[0]);
    }
    assert.equal(seen.size, 3);
  }
});
test('local configuration is data only and contacts cannot be disabled', () => {
  assert.throws(() =>
    resolvePreset('US', 'tech', { overrides: { common: { script: 'process.exit()' } } })
  );
  assert.throws(() => resolvePreset('US', 'tech', { disabledFields: ['phone'] }));
  const p = resolvePreset('US', 'tech', {
    symbols: '*',
    overrides: { types: { tech: { symbols: '+' } }, pairs: { 'US:tech': { symbols: '★' } } }
  });
  assert.equal(p.symbols, '★');
});
