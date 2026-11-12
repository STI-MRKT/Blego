const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
test('reference copies only explicitly selected available fields and detects changed source', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-reference-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = await imageFixture(root);
  const service = createImageService();
  const reference = await service.addReference(file);
  assert.deepEqual(Object.keys(service.groups.snapshot().membership), []);
  assert.deepEqual(
    await service.referenceOperations({ referenceId: reference.referenceId, fields: [] }),
    []
  );
  const ops = await service.referenceOperations({
    referenceId: reference.referenceId,
    fields: ['title', 'author', 'iso']
  });
  assert.deepEqual(
    ops.map((x) => x.field),
    ['title', 'author']
  );
  assert.equal(ops[0].origin.kind, 'reference');
  assert.equal(ops[0].origin.sourceHash, reference.sourceHash);
  await assert.rejects(
    service.referenceOperations({
      referenceId: reference.referenceId,
      fields: ['personalIdentifiers']
    }),
    /REFERENCE_FIELD/
  );
  await assert.rejects(
    service.referenceOperations({ referenceId: reference.referenceId, fields: ['Orientation'] }),
    /REFERENCE_FIELD/
  );
  fs.appendFileSync(file, 'changed');
  await assert.rejects(
    service.referenceOperations({ referenceId: reference.referenceId, fields: ['title'] }),
    /SOURCE_CHANGED/
  );
});
