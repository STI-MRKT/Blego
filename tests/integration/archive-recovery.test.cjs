const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
test('failure after no-overwrite finalization recovers ZIP and lost catalogue', async (t) => {
  const f = await fixture(t);
  const svc = createArchiveService({
    ...f,
    fault: (stage) => {
      if (stage === 'afterRename') throw Error('fault');
    }
  });
  await assert.rejects(svc.saveArchive(f.id));
  assert.equal(svc.listArchives().items.length, 0);
  const recovered = createArchiveService(f);
  assert.equal((await recovered.recover()).recovered, 1);
  const old = recovered.listArchives().items[0];
  f.store.db.exec('DELETE FROM archives');
  assert.equal((await recovered.recover()).recovered, 1);
  assert.equal(recovered.listArchives().items[0].lastOpenedAt, null);
  assert.equal(recovered.listArchives().items[0].processedAt, old.processedAt);
});
test('write faults never report ready and corrupt ZIP is rejected', async (t) => {
  for (const stage of ['pending', 'writing']) {
    const f = await fixture(t);
    const svc = createArchiveService({
      ...f,
      fault: (s) => {
        if (s === stage) throw Object.assign(Error('disk'), { code: 'ENOSPC' });
      }
    });
    await assert.rejects(svc.saveArchive(f.id));
    assert.equal(svc.listArchives().items.length, 0);
  }
  const f = await fixture(t);
  const svc = createArchiveService(f);
  const a = await svc.saveArchive(f.id);
  fs.writeFileSync(path.join(f.root, 'archives', a.fileName), 'bad');
  await assert.rejects(svc.openArchive(a.archiveId));
  assert.equal(svc.listArchives().items[0].lastOpenedAt, null);
});
test('verified temp before finalization resumes without reclassification', async (t) => {
  const f = await fixture(t);
  const svc = createArchiveService({
    ...f,
    fault: (s) => {
      if (s === 'beforeRename') throw Error('fault');
    }
  });
  await assert.rejects(svc.saveArchive(f.id));
  const next = createArchiveService(f);
  assert.equal((await next.recover()).recovered, 1);
  assert.equal(next.listArchives().items.length, 1);
});
test('ZIP byte limits, symlinks, traversal and CRC tampering reject', async (t) => {
  const f = await fixture(t);
  const { writeZip, readZip } = require('../../electron/features/archive/zip.cjs');
  const svc = createArchiveService(f);
  const a = await svc.saveArchive(f.id);
  const file = path.join(f.root, 'archives', a.fileName);
  await assert.rejects(readZip(file, { maxBytes: 1 }));
  await assert.rejects(readZip(file, { maxFiles: 1 }));
  const link = path.join(f.root, 'link.zip');
  fs.symlinkSync(file, link);
  await assert.rejects(readZip(link));
  const zip = path.join(f.root, 'bad.zip');
  await writeZip(zip, { 'aa/xx': Buffer.from('x') });
  let data = fs.readFileSync(zip);
  data = Buffer.from(data.toString('latin1').replaceAll('aa/xx', '../xx'), 'latin1');
  fs.writeFileSync(zip, data);
  await assert.rejects(readZip(zip));
  const good = fs.readFileSync(file);
  good[good.indexOf(Buffer.from('result.txt')) + 11] ^= 255;
  fs.writeFileSync(file, good);
  await assert.rejects(readZip(file));
});
test('real permission denial preserves old ZIP; cancelled save is not ready', async (t) => {
  const f = await fixture(t);
  const svc = createArchiveService(f);
  const a = await svc.saveArchive(f.id);
  const original = fs.readFileSync(path.join(f.root, 'archives', a.fileName));
  const blocked = path.join(f.root, 'blocked');
  fs.mkdirSync(blocked);
  fs.chmodSync(blocked, 0);
  try {
    await assert.rejects(
      svc.exportArchive(a.archiveId, path.join(blocked, 'out.zip')),
      (e) => e.code === 'EACCES'
    );
  } finally {
    fs.chmodSync(blocked, 0o700);
  }
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'archives', a.fileName)), original);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(svc.saveArchive(f.id, { cancellation: abort.signal }));
  assert.equal(svc.listArchives().items.length, 1);
});

test('TZ06 retry after pre-write failure saves confirmed data without deleting foreign files', async (t) => {
  const f = await fixture(t);
  let fail = true;
  const svc = createArchiveService({
    ...f,
    fault: (stage) => {
      if (fail && stage === 'writing') throw Object.assign(Error('disk'), { code: 'ENOSPC' });
    }
  });
  await assert.rejects(svc.saveArchive(f.id));
  fail = false;
  const archive = await svc.saveArchive(f.id);
  assert.equal(svc.listArchives().total, 1);
  assert.ok((await svc.openArchive(archive.archiveId)).entries['result.txt'].length);
  assert.equal((await svc.saveArchive(f.id)).archiveId, archive.archiveId);
});

test('TZ06 selected classified record archives only its seven fields, retains source operation and is idempotent', async (t) => {
  const f = await fixture(t);
  const {
    createClassificationService
  } = require('../../electron/features/classification/service.cjs');
  const classification = createClassificationService();
  t.after(() => classification.close());
  const input = await classification.read({
    requestId: 'select-test',
    originalName: 'two.txt',
    bytes: Buffer.from(
      'id:0001|email:first@example.test|cookies:FAKE_FIRST\nid:0002|email:second@example.test|cookies:FAKE_SECOND'
    )
  });
  classification.confirmClassification(input.operationId, 'accept_complete');
  const svc = createArchiveService({ ...f, classification });
  const a = await svc.saveArchive(input.operationId, { recordId: '2' });
  const text = (await svc.openArchive(a.archiveId)).entries['result.txt'].toString();
  assert.ok(text.includes('second@example.test'));
  assert.ok(!text.includes('first@example.test'));
  assert.ok(!text.includes('FAKE_SECOND'));
  assert.equal(a.counts.total, 1);
  assert.equal(classification.page(input.operationId).records.length, 2);
  assert.equal(
    (await svc.saveArchive(input.operationId, { recordId: '2' })).archiveId,
    a.archiveId
  );
});
