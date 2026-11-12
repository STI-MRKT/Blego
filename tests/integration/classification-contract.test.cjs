const {test}=require('node:test');const assert=require('node:assert/strict');
const {createClassificationService}=require('../../electron/features/classification/service.cjs');
test('rules_pending cannot be confirmed or forged and production refuses fixtures',async()=>{
 const svc=createClassificationService();const p=await svc.read({requestId:'one',bytes:Buffer.from('один\nдва'),originalName:'x.txt'});
 assert.equal(p.status,'rules_pending');assert.equal(p.counts.total,2);assert.throws(()=>svc.confirmClassification(p.operationId,'accept_complete'));assert.throws(()=>svc.getConfirmed('forged'));assert.throws(()=>svc.classifyDocument({}, {testOnly:true}));svc.close();
});
test('explicit test rules account for all records and partial requires consent',async()=>{
 const {parseInput}=await import('../../shared/importer.mjs');const parsed=await parseInput({bytes:Buffer.from('ok\n?'),originalName:'test.txt'});
 const svc=createClassificationService({allowTestRules:true});const p=svc.classifyDocument(parsed,{testOnly:true,version:'TEST-ONLY-1',classify:r=>r.data.text==='?'?null:r.data.text});
 assert.equal(p.status,'preview_partial');assert.equal(p.counts.processed+p.counts.unresolved,p.counts.total);assert.throws(()=>svc.confirmClassification(p.operationId,'accept_complete'));
 const confirmed=svc.confirmClassification(p.operationId,'accept_partial');assert.equal(confirmed.status,'partial_confirmed');assert.equal(svc.getConfirmed(p.operationId).resultText,'ok');svc.close();
});
test('cancellation terminates parse worker without producing an operation',async()=>{
 const svc=createClassificationService();const work=svc.read({requestId:'cancel',bytes:Buffer.from('x\n'.repeat(100000)),originalName:'x.txt'});svc.cancel('cancel');await assert.rejects(work,/CANCELLED/);svc.close();
});
