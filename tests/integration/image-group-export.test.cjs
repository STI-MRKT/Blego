const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageFixture, distinctCopies } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
test('group plans freeze per-file rules, reject stale revisions, double click writes once and retry is selective', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-group-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = await imageFixture(root, 'png', { metadata: false });
  const out = path.join(root, 'out');
  fs.mkdirSync(out);
  let fail = true;
  const service = createImageService({
    hooks: {
      beforeWrite: () => {
        if (fail) {
          fail = false;
          throw Error('METADATA_TEST_FAILURE');
        }
      }
    }
  });
  const files = await service.addFiles(distinctCopies(source, 3));
  for (const f of files) await service.readImageMetadata(f.fileId);
  const group = service.groups.createGroup({ name: 'A' });
  service.groups.moveFiles({ fileIds: files.map((x) => x.fileId), targetGroupId: group.id });
  service.groups.setGroupOperations({
    groupId: group.id,
    operations: [
      { field: 'title', action: 'set', value: 'Group title', origin: { kind: 'manual' } }
    ]
  });
  service.groups.setFileOverrides({
    fileId: files[2].fileId,
    overrides: [{ field: 'title', action: 'keep' }]
  });
  const destinations = { [group.id]: await service.addDestination(out) };
  async function prepare(extra = {}) {
    return service.prepareGroupExport({
      scope: 'all',
      workspaceRevision: service.groups.snapshot().revision,
      destinationByGroup: destinations,
      ...extra
    });
  }
  const stale = await prepare();
  service.groups.renameGroup({ groupId: group.id, name: 'Renamed' });
  await assert.rejects(
    service.applyGroupExport({
      planId: stale.planId,
      workspaceRevision: stale.workspaceRevision,
      runId: 'stale'
    }),
    /PLAN_STALE/
  );
  const plan = await prepare();
  assert.equal(plan.files[2].operations[0].action, 'keep');
  const request = {
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'first'
  };
  const [a, b] = await Promise.all([
    service.applyGroupExport(request),
    service.applyGroupExport(request)
  ]);
  assert.deepEqual(a, b);
  assert.equal(a.files.filter((x) => x.status === 'completed').length, 1);
  assert.equal(a.files.filter((x) => x.status === 'no_changes').length, 1);
  assert.equal(fs.readdirSync(out).length, 1);
  const failed = a.files.find((x) => x.status === 'failed');
  await assert.rejects(
    prepare({
      retryRunId: 'first',
      fileIds: [a.files.find((x) => x.status === 'completed').fileId]
    }),
    /INVALID_RETRY/
  );
  const retry = await prepare({ retryRunId: 'first', fileIds: [failed.fileId] });
  assert.equal(retry.files.length, 1);
  const retried = await service.applyGroupExport({
    planId: retry.planId,
    workspaceRevision: retry.workspaceRevision,
    runId: 'retry'
  });
  assert.equal(retried.files[0].status, 'completed');
  assert.equal(
    service.exportHistory()[0].files.find((x) => x.fileId === failed.fileId).status,
    'failed'
  );
  assert.equal(fs.readdirSync(out).length, 2);
  const movedDestination = await prepare();
  fs.renameSync(out, out + '-original');
  fs.mkdirSync(out);
  await assert.rejects(
    service.applyGroupExport({
      planId: movedDestination.planId,
      workspaceRevision: movedDestination.workspaceRevision,
      runId: 'folder-replaced'
    }),
    /PLAN_STALE/
  );
  fs.rmdirSync(out);
  fs.renameSync(out + '-original', out);
  const changed = await prepare();
  fs.appendFileSync(
    path.join(root, path.basename(source, path.extname(source)) + '-0.png'),
    'changed'
  );
  await assert.rejects(
    service.applyGroupExport({
      planId: changed.planId,
      workspaceRevision: changed.workspaceRevision,
      runId: 'changed'
    }),
    /PLAN_STALE/
  );
});
test('group cancellation leaves other groups running and stale run cannot cancel', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-group-cancel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = await imageFixture(root, 'png', { metadata: false });
  const service = createImageService();
  const files = await service.addFiles(distinctCopies(source, 4));
  for (const f of files) await service.readImageMetadata(f.fileId);
  const group = service.groups.createGroup({ name: 'Cancelled' });
  service.groups.moveFiles({
    fileIds: files.slice(0, 2).map((f) => f.fileId),
    targetGroupId: group.id
  });
  for (const id of [group.id, 'ungrouped'])
    service.groups.setGroupOperations({
      groupId: id,
      operations: [{ field: 'title', action: 'set', value: 'Value', origin: { kind: 'manual' } }]
    });
  const token = await service.addDestination(root);
  const plan = await service.prepareGroupExport({
    scope: 'all',
    workspaceRevision: service.groups.snapshot().revision,
    destinationByGroup: { [group.id]: token, ungrouped: token }
  });
  const events = [];
  const job = service.applyGroupExport(
    { planId: plan.planId, workspaceRevision: plan.workspaceRevision, runId: 'current' },
    (e) => events.push(e)
  );
  assert.equal(service.cancelGroupExport({ runId: 'old', groupId: group.id }), false);
  assert.equal(service.cancelGroupExport({ runId: 'current', groupId: group.id }), true);
  const report = await job;
  assert.equal(
    report.files.filter((f) => f.groupId === group.id && f.status === 'cancelled').length,
    2
  );
  assert.equal(
    report.files.filter((f) => f.groupId === 'ungrouped' && f.status === 'completed').length,
    2
  );
  assert.ok(events.every((e) => e.runId === 'current'));
});
