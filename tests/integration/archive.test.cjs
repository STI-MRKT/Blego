const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
test('test-only classification ZIP roundtrip, idempotence, original opt-in, last opened', async (t) => {
  const f = await fixture(t);
  let svc = createArchiveService(f);
  const [a, b] = await Promise.all([svc.saveArchive(f.id), svc.saveArchive(f.id)]);
  assert.equal(a.archiveId, b.archiveId);
  assert.equal(svc.listArchives().items.length, 1);
  svc = createArchiveService(f);
  const opened = await svc.openArchive(a.archiveId);
  assert.equal(opened.entries['result.txt'].toString(), 'Тест');
  assert.equal(opened.entries['unresolved.txt'].toString(), '"?"');
  assert.ok(!opened.entries['source/original.txt']);
  assert.ok(svc.listArchives().items[0].lastOpenedAt);
  assert.equal(svc.listArchives().items[0].fileName, a.fileName);
  const dest = path.join(f.root, 'export.zip');
  await svc.exportArchive(a.archiveId, dest);
  assert.deepEqual(
    fs.readFileSync(dest),
    fs.readFileSync(path.join(f.root, 'archives', a.fileName))
  );
  await assert.rejects(svc.saveArchive({ operationId: f.id, status: 'completed' }));
  await assert.rejects(svc.saveArchive('forged'));
});
test('pending input rejected and original copy preserves exact bytes', async (t) => {
  const f = await fixture(t);
  const svc = createArchiveService(f);
  const pending = await f.classification.read({
    requestId: 'pending',
    bytes: Buffer.from('source'),
    originalName: 'source.txt'
  });
  await assert.rejects(svc.saveArchive(pending.operationId));
  const a = await svc.saveArchive(f.id, { includeOriginal: true });
  const o = await svc.openArchive(a.archiveId);
  assert.deepEqual(o.entries['source/original.txt'], Buffer.from('Тест\n?'));
});
test('same source and processing second have distinct immutable filenames', async (t) => {
  const f = await fixture(t);
  const { parseInput } = await import('../../shared/importer.mjs');
  const parsed = await parseInput({ bytes: Buffer.from('new'), originalName: 'пример.txt' });
  const op = f.classification.classifyDocument(parsed, {
    testOnly: true,
    version: 'TEST-2',
    classify: (r) => r.data.text
  });
  f.classification.confirmClassification(op.operationId, 'accept_complete');
  const svc = createArchiveService(f);
  const a = await svc.saveArchive(f.id),
    b = await svc.saveArchive(op.operationId);
  assert.notEqual(a.fileName, b.fileName);
  const tz = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Honolulu';
    await svc.openArchive(a.archiveId);
    assert.equal(
      svc.listArchives().items.find((e) => e.archiveId === a.archiveId).fileName,
      a.fileName
    );
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});
test('date filter includes full UTC day and archive removal keeps issued contacts', async (t) => {
  const f = await fixture(t);
  const svc = createArchiveService(f);
  const a = await svc.saveArchive(f.id);
  const { generateProfile } = require('../../electron/features/generator/service.cjs');
  await generateProfile(
    { country: 'US', type: 'model', requestId: 'keep-registry' },
    { store: f.store }
  );
  const n = f.store.db.prepare('SELECT count(*) n FROM issued').get().n;
  const day = a.processedAt.slice(0, 10);
  assert.equal(svc.listArchives({ from: day, to: day }).total, 1);
  await svc.removeArchive(a.archiveId);
  assert.equal(svc.listArchives().total, 0);
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM issued').get().n, n);
});
