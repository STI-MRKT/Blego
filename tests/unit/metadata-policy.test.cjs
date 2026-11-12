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
