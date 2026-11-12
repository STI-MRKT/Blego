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
test('saved reference proof requires fresh explicit authorization and can be rebound by unchanged hash', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-ref-reopen-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = await imageFixture(root, 'png');
  const target = await imageFixture(root, 'png', { name: 'target.png', metadata: false });
  const data = new Map();
  const store = {
    get: (k) => data.get(k),
    set: (k, v) => data.set(k, structuredClone(v)),
    transaction: (fn) => fn()
  };
  let service = createImageService({ store });
  const reference = await service.addReference(source);
  const operations = await service.referenceOperations({
    referenceId: reference.referenceId,
    fields: ['title']
  });
  service.groups.setGroupOperations({ groupId: 'ungrouped', operations });
  service.groups.save();
  service = createImageService({ store });
  const [file] = await service.addFiles([target]);
  await service.readImageMetadata(file.fileId);
  const destinationByGroup = { ungrouped: await service.addDestination(root) };
  const prepare = () =>
    service.prepareGroupExport({
      scope: 'all',
      workspaceRevision: service.groups.snapshot().revision,
      destinationByGroup
    });
  await assert.rejects(prepare(), /PLAN_STALE/);
  const renewed = await service.addReference(source);
  assert.notEqual(renewed.referenceId, reference.referenceId);
  const plan = await prepare();
  assert.equal(plan.files.length, 1);
  assert.equal(plan.files[0].operations[0].value, 'Исходный заголовок');
});
