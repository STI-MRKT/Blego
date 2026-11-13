const { test } = require('node:test');
const assert = require('node:assert/strict');
test('catalog reports real capacities and data deficits, not product-sized full profile promises', async () => {
  const { getPoolStats } = require('../../electron/features/generator/catalog.cjs');
  const stats = getPoolStats({ country: 'BR', type: 'model' });
  assert.equal(stats.counts.firstNames, 81);
  assert.equal(stats.counts.lastNames, 21);
  assert.equal(stats.counts.localityPostalLinks, 500);
  assert.equal(stats.capacities.nameCombinations.available, 1701 + 32);
  assert.equal(stats.capacities.phone.certainty, 'estimated');
  assert.equal(stats.capacities.bio.available, 80);
  assert.ok(stats.deficits.firstNames > 0);
  assert.equal(stats.deficits.verifiedPostalLinks, 200);
  assert.ok(stats.limitingFields.includes('status'));
});
test('bulk mode requires explicit consent while existing optional-repeat settings remain compatible', () => {
  const { resolvePreset } = require('../../electron/features/generator/sources.cjs');
  assert.throws(() => resolvePreset('US', 'tech', { bulkMode: true }), {
    message: 'BULK_CONSENT_REQUIRED'
  });
  const preset = resolvePreset('US', 'tech', { bulkMode: true, bulkConsent: true });
  assert.ok(preset.allowRepeats.includes('postalCode'));
  assert.ok(!preset.allowRepeats.includes('phone'));
  assert.deepEqual(resolvePreset('US', 'tech', { allowRepeats: ['bio'] }).allowRepeats, ['bio']);
});
