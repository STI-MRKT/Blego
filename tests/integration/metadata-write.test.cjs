const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { inspectStructure, decodeHash } = require('../../electron/features/images/structure.cjs');
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-write-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('real JPEG PNG WebP exports update known copies, preserve originals, encoded content and rendered orientation/color/alpha', async (t) => {
  const root = fixture(t),
    out = path.join(root, 'выход');
  fs.mkdirSync(out);
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = await imageFixture(root, format, {
      name: `- пробел ; $(never).${format === 'jpeg' ? 'jpg' : format}`
    });
    const original = hash(file);
    const service = createImageService();
    const [item] = await service.addFiles([file]);
    const before = await service.readImageMetadata(item.fileId);
    const operations = [
      { field: 'title', action: 'set', value: 'Тест <пример> — café' },
      { field: 'author', action: 'set', value: 'Новый автор' },
      { field: 'keywords', action: 'set', value: ['слово', 'café'] },
      {
        field: 'captureDate',
        action: 'set',
        value: { local: '2024-02-29T12:30:00', offset: null }
      },
      { field: 'gps', action: 'remove' }
    ];
    const plan = service.planMetadataChanges({ fileIds: [item.fileId], operations });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(out)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    const target = path.join(out, result.files[0].outputName);
    assert.equal(hash(file), original);
    assert.notEqual(target, file);
    assert.equal(
      inspectStructure(fs.readFileSync(target)).protectedHash,
      inspectStructure(fs.readFileSync(file)).protectedHash
    );
    assert.deepEqual(await decodeHash(target), before.imageInfo);
    const tags = (await createEngine().read(target)).tags;
    assert.ok(!Object.keys(tags).some((k) => /GPSLatitude|GPSLongitude/.test(k)));
    const authors = Object.entries(tags).filter(([k]) =>
      /:(?:Artist|Creator|By-line|Author)$/.test(k)
    );
    assert.ok(authors.length >= 2);
    for (const [, v] of authors) assert.deepEqual(Array.isArray(v) ? v : [v], ['Новый автор']);
    assert.equal(fs.readdirSync(out).filter((n) => n.startsWith('.blego')).length, 0);
  }
});
test('export refuses changed originals, tampered verification and invalid destination; keep-only creates no file', async (t) => {
  const root = fixture(t),
    file = await imageFixture(root),
    out = path.join(root, 'out');
  fs.mkdirSync(out);
  const service = createImageService();
  const [item] = await service.addFiles([file]);
  await service.readImageMetadata(item.fileId);
  const plan = service.planMetadataChanges({
    fileIds: [item.fileId],
    operations: [{ field: 'title', action: 'set', value: 'new' }]
  });
  await assert.rejects(
    service.applyMetadataPlan({ planId: plan.planId, destinationToken: out }),
    /INVALID_DESTINATION/
  );
  fs.appendFileSync(file, 'changed');
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(out)
  });
  assert.equal(result.files[0].error, 'SOURCE_CHANGED');
  assert.deepEqual(fs.readdirSync(out), []);
  const pristine = await imageFixture(root, 'png');
  const broken = createImageService({
    engine: { ...createEngine(), writeCopy: async () => ({ warning: false }) }
  });
  const [p] = await broken.addFiles([pristine]);
  await broken.readImageMetadata(p.fileId);
  const bp = broken.planMetadataChanges({
    fileIds: [p.fileId],
    operations: [{ field: 'title', action: 'set', value: 'not-written' }]
  });
  const failed = await broken.applyMetadataPlan({
    planId: bp.planId,
    destinationToken: await broken.addDestination(out)
  });
  assert.equal(failed.files[0].status, 'failed');
  assert.match(failed.files[0].error, /VERIFY/);
  assert.deepEqual(fs.readdirSync(out), []);
  const keep = broken.planMetadataChanges({
    fileIds: [p.fileId],
    operations: [{ field: 'title', action: 'keep' }]
  });
  assert.equal(
    (
      await broken.applyMetadataPlan({
        planId: keep.planId,
        destinationToken: await broken.addDestination(out)
      })
    ).files[0].status,
    'no_changes'
  );
});
test('GPS dates text namespaces and privacy preset round-trip all static formats', async (t) => {
  const root = fixture(t);
  const out = path.join(root, 'out');
  fs.mkdirSync(out);
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = await imageFixture(root, format);
    const service = createImageService();
    const [item] = await service.addFiles([file]);
    await service.readImageMetadata(item.fileId);
    const operations = [
      'title',
      'description',
      'author',
      'copyright',
      'comment',
      'make',
      'model',
      'software'
    ].map((field) => ({ field, action: 'set', value: 'Тест café' }));
    operations.push(
      {
        field: 'gps',
        action: 'set',
        value: { latitude: -33.25, longitude: -70.75, altitude: -10 }
      },
      {
        field: 'captureDate',
        action: 'set',
        value: { local: '2025-10-03T09:05:07', offset: '+03:30' }
      }
    );
    const plan = service.planMetadataChanges({ fileIds: [item.fileId], operations });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(out)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    const [copy] = await service.addFiles([path.join(out, result.files[0].outputName)]);
    await service.readImageMetadata(copy.fileId);
    const privacy = service.planMetadataChanges({ fileIds: [copy.fileId], presetId: 'privacy-v1' });
    const removed = await service.applyMetadataPlan({
      planId: privacy.planId,
      destinationToken: await service.addDestination(out)
    });
    assert.equal(removed.files[0].status, 'completed', JSON.stringify(removed));
  }
});
test('write failures, cancellation and restart cleanup preserve originals and unrelated files', async (t) => {
  const root = fixture(t),
    file = await imageFixture(root),
    original = hash(file),
    out = path.join(root, 'out');
  fs.mkdirSync(out);
  for (const code of ['ENOSPC', 'EACCES', 'METADATA_ENGINE_FAILED']) {
    const service = createImageService({
      hooks: {
        beforeWrite: () => {
          throw Object.assign(Error(code), { code });
        }
      }
    });
    const [item] = await service.addFiles([file]);
    await service.readImageMetadata(item.fileId);
    const plan = service.planMetadataChanges({
      fileIds: [item.fileId],
      operations: [{ field: 'title', action: 'remove' }]
    });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(out)
    });
    assert.equal(result.files[0].error, code);
    assert.equal(hash(file), original);
    assert.deepEqual(fs.readdirSync(out), []);
  }
  const service = createImageService();
  const items = await service.addFiles([file, file, file]);
  for (const item of items) await service.readImageMetadata(item.fileId);
  const plan = service.planMetadataChanges({
    fileIds: items.map((i) => i.fileId),
    operations: [{ field: 'title', action: 'remove' }]
  });
  let cancelled = false;
  const result = await service.applyMetadataPlan(
    { planId: plan.planId, destinationToken: await service.addDestination(out) },
    (event) => {
      if (event.status === 'completed' && !cancelled) {
        cancelled = true;
        service.cancelExport();
      }
    }
  );
  assert.ok(result.files.some((f) => f.status === 'completed'));
  assert.ok(result.files.some((f) => f.status === 'cancelled'));
  assert.equal(hash(file), original);
  assert.ok(fs.readdirSync(out).every((n) => !n.startsWith('.blego')));
  const own = path.join(out, '.blego-meta-owned'),
    other = path.join(out, '.blego-meta-other');
  fs.mkdirSync(own);
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(own, 'owner.json'), JSON.stringify({ marker: 'test' }));
  fs.writeFileSync(path.join(other, 'owner.json'), JSON.stringify({ marker: 'other' }));
  let data = { [own]: 'test', [other]: 'wrong' };
  const recovery = createImageService({
    store: {
      get: (key) => (key === 'metadata:pending' ? data : undefined),
      set: (key, value) => {
        if (key === 'metadata:pending') data = value;
      }
    }
  });
  await recovery.recover();
  assert.ok(!fs.existsSync(own));
  assert.ok(fs.existsSync(other));
});
