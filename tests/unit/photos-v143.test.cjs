const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ11 automatic preview preserves hidden group metadata and dragged GPS without mutating workspace', async () => {
  const { emptyWorkspace } = await import('../../shared/image-workspace.mjs');
  const { imageDraftPlan, hasImageChanges } = await import('../../src/js/services/photo-plan.js');
  const workspace = emptyWorkspace();
  workspace.membership = { a: 'ungrouped', b: 'ungrouped' };
  workspace.groups[0].operations = [
    { field: 'title', action: 'set', value: 'Existing title', origin: { kind: 'manual' } }
  ];
  workspace.overrides.a = [
    {
      field: 'gps',
      action: 'set',
      value: { latitude: 1, longitude: 2, altitudeMode: 'keep', altitude: null },
      origin: { kind: 'manual' }
    }
  ];
  const before = structuredClone(workspace);
  const operation = {
    field: 'captureDate',
    action: 'set',
    scope: ['exif', 'xmp'],
    value: { local: '2025-01-02T03:04:05', offsetMode: 'keep', offset: null },
    origin: { kind: 'manual' }
  };
  const draft = imageDraftPlan(workspace, {
    fileIds: ['a', 'b'],
    operations: [
      operation,
      {
        field: 'gps',
        action: 'set',
        value: { latitude: 3, longitude: 4, altitudeMode: 'keep', altitude: null },
        origin: { kind: 'manual' }
      }
    ],
    touched: ['captureDate', 'gps'],
    excludedGps: ['a']
  });
  const a = draft.batches.find((b) => b.fileIds.includes('a')).operations;
  assert.equal(a.find((o) => o.field === 'title').value, 'Existing title');
  assert.equal(a.find((o) => o.field === 'gps').value.latitude, 1);
  assert.equal(a.find((o) => o.field === 'captureDate').value.local, operation.value.local);
  assert.deepEqual(workspace, before);
  assert.equal(
    hasImageChanges({ files: [{ beforeAfter: [{ operation: 'set', before: 0, after: 0 }] }] }),
    false
  );
  assert.equal(
    hasImageChanges({ files: [{ beforeAfter: [{ operation: 'set', before: 1, after: 0 }] }] }),
    true
  );
});
