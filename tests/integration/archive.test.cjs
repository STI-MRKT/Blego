const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {fixture}=require('../fixtures/archive.cjs');const {createArchiveService}=require('../../electron/features/archive/service.cjs');
test('test-only classification ZIP roundtrip, idempotence, original opt-in, last opened',async t=>{
 const f=await fixture(t);let svc=createArchiveService(f);const [a,b]=await Promise.all([svc.saveArchive(f.id),svc.saveArchive(f.id)]);assert.equal(a.archiveId,b.archiveId);assert.equal(svc.listArchives().items.length,1);
 svc=createArchiveService(f);const opened=await svc.openArchive(a.archiveId);assert.equal(opened.entries['result.txt'].toString(),'Тест');assert.equal(opened.entries['unresolved.txt'].toString(),'"?"');assert.ok(!opened.entries['source/original.txt']);assert.ok(svc.listArchives().items[0].lastOpenedAt);assert.equal(svc.listArchives().items[0].fileName,a.fileName);
 const dest=path.join(f.root,'export.zip');await svc.exportArchive(a.archiveId,dest);assert.deepEqual(fs.readFileSync(dest),fs.readFileSync(path.join(f.root,'archives',a.fileName)));
 await assert.rejects(svc.saveArchive({operationId:f.id,status:'completed'}));await assert.rejects(svc.saveArchive('forged'));
});
test('pending input rejected and original copy preserves exact bytes',async t=>{
 const f=await fixture(t);const svc=createArchiveService(f);const pending=await f.classification.read({requestId:'pending',bytes:Buffer.from('source'),originalName:'source.txt'});await assert.rejects(svc.saveArchive(pending.operationId));
 const a=await svc.saveArchive(f.id,{includeOriginal:true});const o=await svc.openArchive(a.archiveId);assert.deepEqual(o.entries['source/original.txt'],Buffer.from('Тест\n?'));
});
