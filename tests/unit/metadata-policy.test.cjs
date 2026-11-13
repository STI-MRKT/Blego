const { test } = require('node:test');
const assert = require('node:assert/strict');
test('metadata operations enforce keep/set/remove, fixed fields, real dates and explicit GPS', () => {
  const { validateOperations } = require('../../electron/features/images/policy.cjs');
  assert.deepEqual(validateOperations([{ field: 'title', action: 'keep' }]), [
    { field: 'title', action: 'keep' }
  ]);
  for (const operations of [
    [{ field: 'Orientation', action: 'remove' }],
    [{ field: 'ICC_Profile', action: 'remove' }],
    [{ field: 'description', action: 'set', value: '' }],
    [{ field: 'gps', action: 'set', value: { latitude: 91, longitude: 0 } }],
    [
      { field: 'captureDate', action: 'set', value: { local: '2026-02-30T10:00:00', offset: null } }
    ],
    [{ field: '-config', action: 'set', value: 'file' }]
  ])
    assert.throws(() => validateOperations(operations));
  assert.equal(
    validateOperations([
      { field: 'captureDate', action: 'set', value: { local: '2026-11-12T10:00:00', offset: null } }
    ])[0].value.offset,
    null
  );
});
test('Keep preserves multi-value or unknown camera metadata, which is not a writable scalar', () => {
  const { verifyTags } = require('../../electron/features/images/write-policy.cjs');
  const { viewTags } = require('../../electron/features/images/policy.cjs');
  const raw = { 'ExifIFD:ISO': [100, 200], 'ExifIFD:FNumber': 'undef' };
  assert.doesNotThrow(() =>
    verifyTags(
      [
        { field: 'iso', action: 'keep' },
        { field: 'fNumber', action: 'keep' }
      ],
      raw,
      structuredClone(raw)
    )
  );
  assert.throws(() =>
    verifyTags([{ field: 'iso', action: 'keep' }], raw, { 'ExifIFD:ISO': [100, 300] })
  );
  assert.deepEqual(viewTags(raw).find((t) => t.field === 'iso').value, [100, 200]);
  assert.equal(viewTags(raw).find((t) => t.field === 'iso').referenceSupported, false);
});
test('GPS altitude Keep works even when the original has no latitude/longitude', () => {
  const { expectedGPS } = require('../../electron/features/images/gps-policy.cjs');
  const { validateOperations } = require('../../shared/metadata-operations.mjs');
  const op = {
    field: 'gps',
    action: 'set',
    value: { latitude: 0, longitude: -1, altitude: null, altitudeMode: 'keep' }
  };
  assert.equal(
    expectedGPS(op, { 'GPS:GPSAltitude': '15', 'GPS:GPSAltitudeRef': '1' }).altitude,
    -15
  );
  for (const mode of ['keep', 'remove'])
    assert.throws(
      () =>
        validateOperations([{ ...op, value: { ...op.value, altitude: 2, altitudeMode: mode } }]),
      /METADATA_INVALID_GPS/
    );
  assert.throws(
    () => validateOperations([{ ...op, value: { ...op.value, altitudeMode: 'set' } }]),
    /METADATA_INVALID_GPS/
  );
});
