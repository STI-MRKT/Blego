const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { createHash } = require('node:crypto');
const { imageFixture } = require('../fixtures/images.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-date-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const out = path.join(root, 'out');
  fs.mkdirSync(out);
  return { root, out, engine: createEngine() };
}
const date = (local, offset) => ({ field: 'captureDate', action: 'set', value: { local, offset } });
async function exportCopy(service, file, operations, out) {
  const [item] = await service.addFiles([file]);
  await service.readImageMetadata(item.fileId);
  const plan = service.planMetadataChanges({ fileIds: [item.fileId], operations });
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(out)
  });
  assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
  return { target: path.join(out, result.files[0].outputName), plan };
}
test('actual date edits keep each source timezone across JPEG/PNG/WebP and preserve original GPS/author/pixels', async (t) => {
  const { root, out, engine } = await setup(t);
  for (const format of ['jpeg', 'png', 'webp'])
    for (const offset of ['+03:00', '-05:00']) {
      const file = await imageFixture(root, format, {
        name: `${format}-${offset.replace(':', '')}.${format}`
      });
      await engine.writeCopy(file, [date('2020-01-02T03:04:05', offset)], format);
      const before = await engine.read(file),
        original = digest(file);
      const { target, plan } = await exportCopy(
        createImageService(),
        file,
        [
          {
            field: 'captureDate',
            action: 'set',
            scope: ['exif', 'xmp'],
            value: { local: '2025-06-07T08:09:10', offsetMode: 'keep', offset: null }
          }
        ],
        out
      );
      const after = (await engine.read(target)).tags;
      assert.equal(normalizedValue('captureDate', after).offset, offset);
      assert.equal(normalizedValue('captureDate', after).local, '2025-06-07T08:09:10');
      assert.equal(digest(file), original);
      assert.deepEqual(normalizedValue('gps', after), normalizedValue('gps', before.tags));
      assert.equal(normalizedValue('author', after), normalizedValue('author', before.tags));
      assert.deepEqual(
        plan.files[0].beforeAfter.map((r) => r.after.offset),
        [offset, offset]
      );
    }
});
test('selected XMP date set/remove leaves EXIF date/offset unchanged; explicit offset removal is verified', async (t) => {
  const { root, out, engine } = await setup(t);
  const file = await imageFixture(root);
  await engine.writeCopy(file, [date('2020-01-02T03:04:05', '+03:00')], 'jpeg');
  const { target } = await exportCopy(
    createImageService(),
    file,
    [
      {
        field: 'captureDate',
        action: 'set',
        scope: ['xmp'],
        value: { local: '2025-06-07T08:09:10', offsetMode: 'set', offset: '-07:00' }
      }
    ],
    out
  );
  const tags = (await engine.read(target)).tags;
  assert.equal(tags['ExifIFD:DateTimeOriginal'], '2020:01:02 03:04:05');
  assert.equal(tags['ExifIFD:OffsetTimeOriginal'], '+03:00');
  assert.deepEqual(
    Object.entries(tags)
      .filter(([k]) => /^XMP-exif:.*DateTimeOriginal$/.test(k))
      .map(([, v]) => v),
    ['2025:06:07 08:09:10-07:00']
  );
  const mixed = await exportCopy(
    createImageService(),
    target,
    [
      {
        field: 'captureDate',
        action: 'set',
        scope: ['exif', 'xmp'],
        value: { local: '2026-01-02T03:04:05', offsetMode: 'keep', offset: null }
      }
    ],
    out
  );
  const mt = (await engine.read(mixed.target)).tags;
  assert.equal(mt['ExifIFD:OffsetTimeOriginal'], '+03:00');
  assert.deepEqual(
    Object.entries(mt)
      .filter(([k]) => /^XMP-exif:.*DateTimeOriginal$/.test(k))
      .map(([, v]) => v),
    ['2026:01:02 03:04:05-07:00']
  );
  const removed = await exportCopy(
    createImageService(),
    target,
    [{ field: 'captureDate', action: 'remove', scope: ['xmp'] }],
    out
  );
  const r = (await engine.read(removed.target)).tags;
  assert.equal(Object.keys(r).filter((k) => /^XMP-exif:.*DateTimeOriginal$/.test(k)).length, 0);
  assert.equal(r['ExifIFD:OffsetTimeOriginal'], '+03:00');
  const noOffset = await exportCopy(
    createImageService(),
    file,
    [
      {
        field: 'captureDate',
        action: 'set',
        scope: ['exif', 'xmp'],
        value: { local: '2025-06-07T08:09:10', offsetMode: 'remove', offset: null }
      }
    ],
    out
  );
  assert.equal(
    normalizedValue('captureDate', (await engine.read(noOffset.target)).tags).offset,
    null
  );
});
test('empty explicit timezone or empty scope is rejected; keep never accepts a hidden replacement offset', () => {
  const { validateOperations } = require('../../shared/metadata-operations.mjs');
  for (const value of [
    { local: '2025-06-07T08:09:10', offsetMode: 'set', offset: null },
    { local: '2025-06-07T08:09:10', offsetMode: 'keep', offset: '+03:00' }
  ])
    assert.throws(() =>
      validateOperations([{ field: 'captureDate', action: 'set', scope: ['exif'], value }])
    );
  assert.throws(() => validateOperations([{ field: 'captureDate', action: 'remove', scope: [] }]));
});
test('group date rules retain per-file offsets and survive store reopen without file permissions', async (t) => {
  const { root, out, engine } = await setup(t);
  const { openStore } = require('../../electron/local/store.cjs');
  let store = await openStore(path.join(root, 'data'));
  t.after(() => store.close());
  const service = createImageService({ store });
  for (const [i, offset] of ['+03:00', '-05:00'].entries()) {
    const file = await imageFixture(root, 'png', { name: `group-${i}.png` });
    await engine.writeCopy(file, [date('2020-01-02T03:04:05', offset)], 'png');
    const [item] = await service.addFiles([file]);
    await service.readImageMetadata(item.fileId);
  }
  const operations = [
    {
      field: 'captureDate',
      action: 'set',
      scope: ['exif', 'xmp'],
      value: { local: '2025-01-02T03:04:05', offsetMode: 'keep', offset: null },
      origin: { kind: 'manual' }
    }
  ];
  service.groups.setGroupOperations({ groupId: 'ungrouped', operations });
  service.groups.save();
  const plan = await service.prepareGroupExport({
    scope: 'all',
    workspaceRevision: service.groups.snapshot().revision,
    destinationByGroup: { ungrouped: await service.addDestination(out) }
  });
  const result = await service.applyGroupExport({
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'timezone-group'
  });
  assert.ok(
    result.files.every((f) => f.status === 'completed'),
    JSON.stringify(result)
  );
  const offsets = [];
  for (const file of result.files)
    offsets.push(
      normalizedValue('captureDate', (await engine.read(path.join(out, file.outputName))).tags)
        .offset
    );
  assert.deepEqual(offsets.sort(), ['+03:00', '-05:00'].sort());
  store.close();
  store = await openStore(path.join(root, 'data'));
  const restored = createImageService({ store }).groups.snapshot();
  assert.deepEqual(restored.groups[0].operations, operations);
  assert.deepEqual(restored.membership, {});
});
