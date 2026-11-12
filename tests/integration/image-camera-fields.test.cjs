const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { validateOperations } = require('../../electron/features/images/policy.cjs');
test('camera numbers validate and round-trip in real JPEG PNG WebP copies', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-camera-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const field of ['iso', 'fNumber', 'focalLength', 'exposureTime']) {
    for (const value of [0, -1, Infinity, '', '1/0', 'camera'])
      assert.throws(() => validateOperations([{ field, action: 'set', value }]));
  }
  assert.throws(() => validateOperations([{ field: 'iso', action: 'set', value: 1.5 }]));
  const operations = [
    { field: 'iso', action: 'set', value: 200 },
    { field: 'fNumber', action: 'set', value: 2.8 },
    { field: 'focalLength', action: 'set', value: 35 },
    { field: 'exposureTime', action: 'set', value: '1/125' }
  ];
  for (const format of ['jpeg', 'png', 'webp']) {
    const source = await imageFixture(root, format);
    const original = fs.readFileSync(source);
    const service = createImageService();
    const [file] = await service.addFiles([source]);
    await service.readImageMetadata(file.fileId);
    const plan = service.planMetadataChanges({ fileIds: [file.fileId], operations });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(root)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(source), original);
  }
});
