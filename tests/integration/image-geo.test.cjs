const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { createGeoService } = require('../../electron/features/geo/service.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');
const { decodeHash } = require('../../electron/features/images/structure.cjs');
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
test('generated per-file GEO stays fixed through preview/export and keeps altitude, dates, pixels and originals in JPEG/PNG/WebP', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-image-geo-'));
  const out = path.join(root, 'out');
  fs.mkdirSync(out);
  const geo = createGeoService();
  t.after(() => {
    geo.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const engine = createEngine(),
    service = createImageService({ geo });
  const originals = new Map();
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = await imageFixture(root, format);
    await engine.writeCopy(
      file,
      [{ field: 'gps', action: 'set', value: { latitude: 1, longitude: 2, altitude: -12.5 } }],
      format
    );
    const [added] = await service.addFiles([file]);
    await service.readImageMetadata(added.fileId);
    originals.set(added.fileId, {
      file,
      hash: hash(file),
      tags: (await engine.read(file)).tags,
      pixels: await decodeHash(file)
    });
  }
  const ids = [...originals.keys()];
  await service.generateGeo({ cityId: 'osm:relation:71525', fileIds: ids, requestId: 'generate' });
  const first = service.groups.snapshot();
  assert.equal(new Set(ids.map((id) => JSON.stringify(first.overrides[id][0].value))).size, 3);
  assert.ok(ids.every((id) => first.overrides[id][0].value.altitudeMode === 'keep'));
  const dest = { ungrouped: await service.addDestination(out) };
  const prepare = () =>
    service.prepareGroupExport({
      scope: 'all',
      workspaceRevision: service.groups.snapshot().revision,
      destinationByGroup: dest
    });
  const plan = await prepare();
  const repeat = await prepare();
  assert.deepEqual(plan.files, repeat.files);
  for (const f of plan.files)
    assert.equal(f.beforeAfter.find((r) => r.field === 'gps').after.altitude, -12.5);
  const result = await service.applyGroupExport({
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'export'
  });
  assert.equal(
    result.files.filter((f) => f.status === 'completed').length,
    3,
    JSON.stringify(result)
  );
  for (const f of result.files) {
    const original = originals.get(f.fileId),
      target = path.join(out, f.outputName),
      tags = (await engine.read(target)).tags;
    const gps = normalizedValue('gps', tags),
      expected = first.overrides[f.fileId][0].value;
    assert.ok(Math.abs(gps.latitude - expected.latitude) < 1e-6);
    assert.ok(Math.abs(gps.longitude - expected.longitude) < 1e-6);
    assert.equal(gps.altitude, -12.5);
    assert.equal(hash(original.file), original.hash);
    assert.deepEqual(await decodeHash(target), original.pixels);
    assert.deepEqual(
      normalizedValue('captureDate', tags),
      normalizedValue('captureDate', original.tags)
    );
    assert.deepEqual(normalizedValue('author', tags), normalizedValue('author', original.tags));
  }
  await service.generateGeo({ cityId: 'osm:relation:71525', fileIds: [ids[0]], requestId: 'one' });
  const changed = service.groups.snapshot();
  assert.notDeepEqual(changed.overrides[ids[0]], first.overrides[ids[0]]);
  assert.deepEqual(changed.overrides[ids[1]], first.overrides[ids[1]]);
  await assert.rejects(
    service.applyGroupExport({
      planId: repeat.planId,
      workspaceRevision: repeat.workspaceRevision,
      runId: 'stale'
    }),
    /PLAN_STALE/
  );
});
test('GEO generation rejects changed selection and cancellation; export retries failed files only', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-geo-retry-')),
    out = path.join(root, 'out');
  fs.mkdirSync(out);
  const geo = createGeoService();
  t.after(() => {
    geo.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let fail = true;
  const service = createImageService({
    geo,
    hooks: {
      beforeWrite: () => {
        if (fail) {
          fail = false;
          throw Object.assign(Error('ENOSPC'), { code: 'ENOSPC' });
        }
      }
    }
  });
  const files = [];
  for (let i = 0; i < 2; i++) files.push(await imageFixture(root, 'png', { name: `${i}.png` }));
  const items = await service.addFiles(files),
    ids = items.map((f) => f.fileId);
  for (const id of ids) await service.readImageMetadata(id);
  const pending = service.generateGeo({
    cityId: 'osm:relation:71525',
    fileIds: ids,
    requestId: 'stale'
  });
  service.groups.select({ fileIds: [ids[0]] });
  await assert.rejects(pending, /PLAN_STALE/);
  assert.deepEqual(service.groups.snapshot().overrides, {});
  const cancelled = service.generateGeo({
    cityId: 'osm:relation:71525',
    fileIds: ids,
    requestId: 'cancel'
  });
  geo.cancel('cancel');
  await assert.rejects(cancelled, /CANCELLED/);
  assert.deepEqual(service.groups.snapshot().overrides, {});
  await service.generateGeo({ cityId: 'osm:relation:71525', fileIds: ids, requestId: 'ready' });
  const destinations = { ungrouped: await service.addDestination(out) };
  const prepare = (extra) =>
    service.prepareGroupExport({
      scope: 'all',
      workspaceRevision: service.groups.snapshot().revision,
      destinationByGroup: destinations,
      ...extra
    });
  const plan = await prepare();
  const first = await service.applyGroupExport({
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'first'
  });
  assert.equal(first.files.filter((f) => f.status === 'completed').length, 1);
  const failed = first.files.find((f) => f.status === 'failed');
  assert.equal(failed.error, 'ENOSPC');
  const retry = await prepare({ retryRunId: 'first', fileIds: [failed.fileId] });
  assert.equal(retry.files.length, 1);
  assert.deepEqual(
    retry.files[0].operations,
    plan.files.find((f) => f.fileId === failed.fileId).operations
  );
  const done = await service.applyGroupExport({
    planId: retry.planId,
    workspaceRevision: retry.workspaceRevision,
    runId: 'retry'
  });
  assert.equal(done.files[0].status, 'completed');
  assert.equal(fs.readdirSync(out).length, 2);
});
test('altitude-only originals retain independent EXIF/XMP values under Keep; explicit Remove clears them', async (t) => {
  const { execFileSync } = require('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-altitude-only-')),
    out = path.join(root, 'out');
  fs.mkdirSync(out);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = await imageFixture(root, 'png');
  const runtime = path.resolve('build/metadata-runtime', `${process.platform}-${process.arch}`);
  const tags = [
    '-config',
    '',
    '-overwrite_original',
    '-n',
    '-GPS:all=',
    '-XMP-exif:GPS*=',
    '-GPS:GPSAltitude=15',
    '-GPS:GPSAltitudeRef=1',
    '-XMP-exif:GPSAltitude=20',
    '-XMP-exif:GPSAltitudeRef=0',
    '--',
    file
  ];
  const windows = process.platform === 'win32';
  execFileSync(
    path.join(runtime, windows ? 'exiftool.exe' : 'bin/perl'),
    windows
      ? tags
      : [
          path.resolve('resources/metadata/perl-bootstrap.pl'),
          require('exiftool-vendored.pl'),
          ...tags
        ],
    {
      env: {
        ...process.env,
        BLEGO_PERL_LIBS: [path.join(runtime, 'lib/core'), path.join(runtime, 'lib/arch')].join(
          '\x1f'
        )
      }
    }
  );
  const engine = createEngine(),
    before = (await engine.read(file)).tags;
  for (const altitudeMode of ['keep', 'remove']) {
    const service = createImageService();
    const [f] = await service.addFiles([file]);
    await service.readImageMetadata(f.fileId);
    const plan = service.planMetadataChanges({
      fileIds: [f.fileId],
      operations: [
        {
          field: 'gps',
          action: 'set',
          value: { latitude: 0, longitude: 0, altitudeMode, altitude: null }
        }
      ]
    });
    assert.equal(plan.files[0].beforeAfter[0].after.altitude, altitudeMode === 'keep' ? -15 : null);
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(out)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    const after = (await engine.read(path.join(out, result.files[0].outputName))).tags;
    const { altitudeValues } = require('../../electron/features/images/gps-policy.cjs');
    assert.deepEqual(altitudeValues(after), altitudeMode === 'keep' ? altitudeValues(before) : {});
  }
});
