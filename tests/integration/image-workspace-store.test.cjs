const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
test('workspace explicit save/reopen preserves presets/settings; session file tokens are not restored', async (t) => {
  const { createGroupStore } = require('../../electron/features/images/groups.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-groups-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const old = {
    p: {
      schemaVersion: 1,
      name: 'Old',
      operations: [{ field: 'title', action: 'set', value: 'Old title' }]
    }
  };
  store.set('metadata:presets', old);
  store.set('settings', { symbols: '★' });
  let groups = createGroupStore({ store });
  const g = groups.createGroup({ name: 'Camera A' });
  groups.addFiles(['f']);
  groups.moveFiles({ fileIds: ['f'], targetGroupId: g.id });
  groups.setGroupOperations({
    groupId: g.id,
    operations: [{ field: 'title', action: 'set', value: 'Entered', origin: { kind: 'manual' } }]
  });
  assert.equal(store.get('metadata:workspace'), undefined);
  groups.save();
  store.close();
  store = await openStore(root);
  groups = createGroupStore({ store });
  assert.equal(groups.snapshot().groups[1].operations[0].value, 'Entered');
  assert.deepEqual(groups.snapshot().membership, {});
  assert.deepEqual(store.get('metadata:presets'), old);
  assert.equal(store.get('settings').symbols, '★');
  const before = groups.snapshot();
  assert.throws(() =>
    groups.setGroupOperations({
      groupId: g.id,
      operations: [{ field: 'title', action: 'set', value: '' }]
    })
  );
  assert.deepEqual(groups.snapshot(), before);
});
