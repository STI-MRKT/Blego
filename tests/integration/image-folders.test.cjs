const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { imageFixture } = require('../fixtures/images.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-folders-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('folder import discovers nested formats, deduplicates physical files and skips symlink cycles; export retains safe relative directories', async (t) => {
  const root = setup(t),
    input = path.join(root, 'album'),
    nested = path.join(input, 'day', 'portraits'),
    out = path.join(root, 'out');
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(out);
  const originals = [];
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = await imageFixture(nested, format);
    originals.push({ file, hash: hash(file) });
  }
  fs.writeFileSync(path.join(input, 'notes.txt'), 'not an image');
  fs.linkSync(originals[0].file, path.join(input, 'duplicate.jpg'));
  fs.symlinkSync(input, path.join(nested, 'loop'), 'dir');
  const service = createImageService(),
    progress = [];
  const added = await service.addFiles([input, nested, originals[0].file], {
    onProgress: (p) => progress.push(p)
  });
  assert.equal(added.length, 3);
  assert.ok(progress.some((p) => p.phase === 'complete' && p.found === 3));
  assert.ok(
    added.every((p) => p.relativePath && !path.isAbsolute(p.relativePath) && p.sourceFolder)
  );
  assert.equal((await service.addFiles([input])).length, 0);
  for (const file of added) await service.readImageMetadata(file.fileId);
  service.groups.setGroupOperations({
    groupId: 'ungrouped',
    operations: [
      {
        field: 'gps',
        action: 'set',
        origin: { kind: 'manual' },
        value: { latitude: 0, longitude: -3, altitudeMode: 'keep', altitude: null }
      }
    ]
  });
  const plan = await service.prepareGroupExport({
    scope: 'all',
    workspaceRevision: service.groups.snapshot().revision,
    destinationByGroup: { ungrouped: await service.addDestination(out) }
  });
  const result = await service.applyGroupExport({
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'folder-run'
  });
  assert.equal(
    result.files.filter((f) => f.status === 'completed').length,
    3,
    JSON.stringify(result)
  );
  for (const file of result.files) {
    const source = added.find((x) => x.fileId === file.fileId);
    assert.equal(path.posix.dirname(file.outputName), path.posix.dirname(source.relativePath));
    assert.ok(fs.existsSync(path.join(out, file.outputName)));
    const gps = normalizedValue(
      'gps',
      (await createEngine().read(path.join(out, file.outputName))).tags
    );
    assert.equal(gps.latitude, 0);
    assert.equal(gps.longitude, -3);
  }
  for (const original of originals) assert.equal(hash(original.file), original.hash);
});
test('1000-file scan is bounded and cancellable; overflow/cancel leaves prior workspace intact', async (t) => {
  const root = setup(t),
    input = path.join(root, 'many');
  fs.mkdirSync(input);
  for (let i = 0; i < 1000; i++)
    fs.writeFileSync(path.join(input, `${i}.jpg`), 'queue-only synthetic bytes');
  const service = createImageService();
  const before = service.groups.snapshot();
  await assert.rejects(
    service.addFiles([input], {
      onProgress: (p) => {
        if (p.found >= 25) service.cancelReads();
      }
    }),
    /CANCELLED/
  );
  assert.deepEqual(service.groups.snapshot(), before);
  const added = await service.addFiles([input]);
  assert.equal(added.length, 1000);
  fs.writeFileSync(path.join(root, 'overflow.jpg'), 'x');
  await assert.rejects(service.addFiles([path.join(root, 'overflow.jpg')]), /IMAGE_QUEUE_LIMIT/);
  assert.equal(Object.keys(service.groups.snapshot().membership).length, 1000);
});
test('folder export refuses an existing symlink directory and never writes outside destination', async (t) => {
  const root = setup(t),
    input = path.join(root, 'album'),
    out = path.join(root, 'out'),
    outside = path.join(root, 'outside');
  for (const dir of [input, out, outside]) fs.mkdirSync(dir);
  await imageFixture(input, 'jpeg');
  const service = createImageService();
  const [file] = await service.addFiles([input]);
  await service.readImageMetadata(file.fileId);
  service.groups.setGroupOperations({
    groupId: 'ungrouped',
    operations: [
      {
        field: 'gps',
        action: 'set',
        origin: { kind: 'manual' },
        value: { latitude: 1, longitude: 2, altitude: null }
      }
    ]
  });
  const plan = await service.prepareGroupExport({
    scope: 'all',
    workspaceRevision: service.groups.snapshot().revision,
    destinationByGroup: { ungrouped: await service.addDestination(out) }
  });
  fs.symlinkSync(outside, path.join(out, path.dirname(file.relativePath)), 'dir');
  const result = await service.applyGroupExport({
    planId: plan.planId,
    workspaceRevision: plan.workspaceRevision,
    runId: 'unsafe'
  });
  assert.equal(result.files[0].status, 'failed');
  assert.equal(result.files[0].error, 'METADATA_UNSAFE_DESTINATION');
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('destination replacement immediately before publication fails closed and preserves unrelated files', async (t) => {
  const root = setup(t),
    input = path.join(root, 'album'),
    out = path.join(root, 'out'),
    outside = path.join(root, 'outside');
  for (const dir of [input, out, outside]) fs.mkdirSync(dir);
  const original = await imageFixture(input, 'png');
  const originalHash = hash(original);
  fs.writeFileSync(path.join(outside, 'sentinel'), 'keep');
  let target;
  const service = createImageService({
    hooks: {
      beforePublish: async () => {
        fs.renameSync(target, target + '.moved');
        fs.symlinkSync(outside, target, 'dir');
      }
    }
  });
  const [file] = await service.addFiles([input]);
  await service.readImageMetadata(file.fileId);
  target = path.join(out, path.dirname(file.relativePath));
  const plan = service.planMetadataChanges({
    fileIds: [file.fileId],
    operations: [
      { field: 'gps', action: 'set', value: { latitude: 0, longitude: 0, altitude: null } }
    ]
  });
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(out)
  });
  assert.equal(result.files[0].error, 'METADATA_UNSAFE_DESTINATION');
  assert.deepEqual(fs.readdirSync(outside), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8'), 'keep');
  assert.equal(hash(original), originalHash);
});

test('retained metadata has an independent memory cap and removing files releases it', async (t) => {
  const root = setup(t),
    base = await imageFixture(root, 'png', { metadata: false });
  const text = 'x'.repeat(7 * 1024 * 1024);
  const service = createImageService({
    engine: { read: async () => ({ tags: { 'XMP-dc:Description': text } }) }
  });
  const paths = [];
  for (let i = 0; i < 5; i++) {
    const file = path.join(root, `${i}.png`);
    fs.copyFileSync(base, file);
    paths.push(file);
  }
  const files = await service.addFiles(paths);
  for (const file of files.slice(0, 4)) await service.readImageMetadata(file.fileId);
  await assert.rejects(service.readImageMetadata(files[4].fileId), /IMAGE_METADATA_LIMIT/);
  service.remove(files[0].fileId);
  assert.equal((await service.readImageMetadata(files[4].fileId)).status, 'ready');
});
