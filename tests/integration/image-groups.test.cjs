const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
test('same canonical path deduplicates, group overrides and presets remain explicit', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-groups-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = await imageFixture(root, 'png', { metadata: false });
  const duplicate = path.join(root, 'different-path.png');
  fs.copyFileSync(file, duplicate);
  const service = createImageService();
  const added = await service.addFiles([file, file, duplicate]);
  assert.equal(added.length, 2);
  assert.equal((await service.addFiles([file])).length, 0);
  const group = service.groups.createGroup({ name: 'Group' });
  service.groups.moveFiles({ fileIds: added.map((x) => x.fileId), targetGroupId: group.id });
  service.groups.setGroupOperations({
    groupId: group.id,
    operations: [{ field: 'title', action: 'set', value: 'Explicit', origin: { kind: 'manual' } }]
  });
  service.groups.setFileOverrides({
    fileId: added[0].fileId,
    overrides: [{ field: 'title', action: 'keep' }]
  });
  assert.equal(service.groups.effective(added[0].fileId)[0].action, 'keep');
  assert.equal(service.groups.effective(added[1].fileId)[0].value, 'Explicit');
  const preset = service.importPreset({
    schemaVersion: 1,
    name: 'One',
    operations: [{ field: 'iso', action: 'set', value: 100 }]
  });
  const copy = service.managePreset({ action: 'duplicate', id: preset.id, name: 'Two' });
  service.managePreset({ action: 'rename', id: copy.id, name: 'Renamed' });
  assert.equal(service.managePreset({ action: 'export', id: copy.id }).name, 'Renamed');
  assert.throws(() => service.managePreset({ action: 'delete', id: copy.id }), /CONFIRMATION/);
  service.managePreset({ action: 'delete', id: copy.id, confirmed: true });
  service.groups.removeGroup({ groupId: group.id, moveTo: 'ungrouped', confirmed: true });
  service.remove(added[0].fileId);
  assert.equal(fs.existsSync(file), true);
  assert.equal(service.groups.snapshot().membership[added[1].fileId], 'ungrouped');
});
