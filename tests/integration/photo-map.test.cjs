const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { createGeoService } = require('../../electron/features/geo/service.cjs');
test('map exposes validated local geometry and only commits unique in-city points against the current revision', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-map-')),
    geo = createGeoService();
  t.after(() => {
    geo.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const service = createImageService({ geo }),
    file = await imageFixture(root, 'jpeg'),
    other = path.join(root, 'other.jpg');
  fs.copyFileSync(file, other);
  const files = await service.addFiles([file, other]);
  for (const f of files) await service.readImageMetadata(f.fileId);
  const cityId = 'osm:relation:71525';
  const map = await geo.boundary({ cityId, requestId: 'boundary' });
  assert.equal(map.city.id, cityId);
  assert.ok(['Polygon', 'MultiPolygon'].includes(map.geometry.type));
  await service.generateGeo({ cityId, fileIds: files.map((f) => f.fileId), requestId: 'generate' });
  const before = service.groups.snapshot(),
    own = before.overrides[files[0].fileId][0],
    otherGPS = before.overrides[files[1].fileId][0].value;
  const move = (value, workspaceRevision = before.revision) =>
    service.moveGeo({
      fileId: files[0].fileId,
      cityId,
      workspaceRevision,
      value,
      requestId: 'move'
    });
  await assert.rejects(move({ latitude: 0, longitude: 0 }), /GEO_POINT_OUTSIDE/);
  await assert.rejects(
    move({ latitude: otherGPS.latitude, longitude: otherGPS.longitude }),
    /GEO_POINT_DUPLICATE/
  );
  await assert.rejects(
    move({ latitude: 48.8566, longitude: 2.3522 }, before.revision - 1),
    /PLAN_STALE/
  );
  assert.deepEqual(service.groups.snapshot(), before);
  const moved = await move({ latitude: 48.856600012, longitude: 2.352200012 });
  assert.deepEqual(moved.workspace.overrides[files[1].fileId], before.overrides[files[1].fileId]);
  const after = moved.workspace.overrides[files[0].fileId][0];
  assert.equal(after.value.latitude, 48.8566);
  assert.equal(after.value.longitude, 2.3522);
  assert.equal(after.value.altitudeMode, own.value.altitudeMode);
  assert.equal(after.origin.sourceHash, own.origin.sourceHash);
});
