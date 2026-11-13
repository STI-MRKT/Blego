const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('map GPS draft rebasing preserves unrelated date edits and leaves multi-selection coordinates individual', async () => {
  const { rebaseGpsDraft } = await import('../../src/js/ui/photos.js');
  const saved = {
    draft: {
      'action-gps': 'set',
      'gps-latitude': '1',
      'gps-longitude': '2',
      'action-captureDate': 'set',
      'date-local': '2025-05-06T12:30:00',
      'date-scope-exif': true
    },
    origins: { gps: { kind: 'manual' }, captureDate: { kind: 'manual' } },
    touched: ['gps', 'captureDate']
  };
  const before = structuredClone(saved),
    ops = [
      {
        field: 'gps',
        action: 'set',
        value: { latitude: 48.8567, longitude: 2.3523, altitudeMode: 'keep' },
        origin: { kind: 'geo', id: 'city' }
      }
    ];
  const single = rebaseGpsDraft(saved, ops);
  assert.equal(single.draft['gps-latitude'], 48.8567);
  assert.equal(single.draft['date-local'], saved.draft['date-local']);
  assert.equal(single.draft['date-scope-exif'], true);
  assert.deepEqual(single.touched, ['captureDate']);
  assert.equal(single.origins.gps.kind, 'geo');
  const multi = rebaseGpsDraft(saved, ops, true, 'photo-a');
  assert.equal(multi.draft['action-gps'], 'set');
  assert.equal(multi.draft['gps-latitude'], '1');
  assert.deepEqual(multi.excludedGps, ['photo-a']);
  assert.deepEqual(multi.touched, ['gps', 'captureDate']);
  assert.deepEqual(rebaseGpsDraft(multi, ops, true, 'photo-b').excludedGps, ['photo-a', 'photo-b']);
  const untouched = rebaseGpsDraft({ ...saved, touched: ['captureDate'] }, ops, true, 'photo-a');
  assert.equal(untouched.draft['action-gps'], 'unchanged');
  assert.equal(multi.draft['date-local'], saved.draft['date-local']);
  assert.deepEqual(saved, before);
});
