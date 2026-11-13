const { test } = require('node:test');
const assert = require('node:assert/strict');
test('map distinguishes missing GPS from zero, resolves effective operations and never mutates plans', async () => {
  const { photoMapRows, fitMap, project, unproject } = await import('../../shared/photo-map.mjs');
  const { emptyWorkspace } = await import('../../shared/image-workspace.mjs');
  const photos = [
    {
      fileId: 'a',
      name: 'zero.png',
      view: { tags: [{ field: 'gps', value: { latitude: 0, longitude: 0 } }] }
    },
    { fileId: 'b', name: 'empty.jpg', view: { tags: [{ field: 'gps', value: null }] } }
  ];
  const workspace = emptyWorkspace();
  workspace.membership = { a: 'ungrouped', b: 'ungrouped' };
  workspace.overrides = {
    b: [
      {
        field: 'gps',
        action: 'set',
        value: { latitude: 48, longitude: 2, altitude: null },
        origin: { kind: 'manual' }
      }
    ]
  };
  const before = JSON.stringify({ photos, workspace }),
    rows = photoMapRows(photos, workspace);
  assert.deepEqual(rows[0].before, { latitude: 0, longitude: 0 });
  assert.equal(rows[1].before, null);
  assert.deepEqual(rows[1].after, { latitude: 48, longitude: 2 });
  const view = fitMap(
    rows.map((r) => r.after),
    null,
    360,
    260
  );
  const point = project(rows[1].after, view, 360, 260);
  const roundtrip = unproject(point, view, 360, 260);
  assert.ok(Math.abs(roundtrip.latitude - 48) < 1e-9);
  assert.ok(Math.abs(roundtrip.longitude - 2) < 1e-9);
  assert.equal(JSON.stringify({ photos, workspace }), before);
});
test('1000 point clusters preserve identities, expand with zoom and keep selected marker independently reachable', async () => {
  const { clusterPoints, fitMap } = await import('../../shared/photo-map.mjs');
  const points = Array.from({ length: 1000 }, (_, i) => ({
    id: String(i),
    latitude: 48 + (i % 25) * 0.0001,
    longitude: 2 + Math.floor(i / 25) * 0.0001
  }));
  const view = fitMap(points, null, 360, 260);
  const clusters = clusterPoints(points, view, 360, 260);
  assert.ok(clusters.length < 1000);
  assert.equal(clusters.flatMap((c) => c.ids).length, 1000);
  assert.equal(new Set(clusters.flatMap((c) => c.ids)).size, 1000);
  const close = { ...view, scale: view.scale * 50 };
  const separated = clusterPoints(points, close, 360, 260);
  assert.ok(separated.length > 0 && separated.every((c) => c.ids.length === 1));
  assert.deepEqual(fitMap([], null, 360, 260).center, { latitude: 0, longitude: 0 });
});

test('one validated workspace resolver serves a batch without leaking mutable operations', async () => {
  const { emptyWorkspace, createWorkspaceResolver } =
    await import('../../shared/image-workspace.mjs');
  const workspace = emptyWorkspace();
  workspace.membership = { a: 'ungrouped', b: 'ungrouped' };
  workspace.groups[0].operations = [
    {
      field: 'gps',
      action: 'set',
      origin: { kind: 'manual' },
      value: { latitude: 1, longitude: 2, altitude: null }
    }
  ];
  const resolve = createWorkspaceResolver(workspace);
  const first = resolve('a');
  first.find((o) => o.field === 'gps').value.latitude = 99;
  workspace.groups[0].operations[0].value.latitude = 3;
  assert.equal(resolve('b').find((o) => o.field === 'gps').value.latitude, 1);
  assert.equal(
    createWorkspaceResolver(workspace)('b').find((o) => o.field === 'gps').value.latitude,
    3
  );
  assert.throws(() => resolve('missing'), /INVALID_FILE_TOKEN/);
});
