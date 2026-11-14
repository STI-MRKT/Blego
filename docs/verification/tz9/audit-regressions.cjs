// Baseline defect witnesses; run explicitly before repairs. All data is synthetic.
const {test}=require('node:test'),assert=require('node:assert/strict');
test('map: one failed tile does not poison another tile',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tz9-audit-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const png=await require('sharp')({create:{width:256,height:256,channels:3,background:'#285d8a'}}).png().toBuffer();
 const service=require('../../../electron/features/geo/tiles.cjs').createTileService({root,request:async url=>{if(url.endsWith('/0/0.png'))throw Error('temporary');return png;}});
 await assert.rejects(service.tile({z:2,x:0,y:0}));
 assert.match(await service.tile({z:2,x:1,y:0}),/^data:image\/png;base64,/);
});
test('classifier: explicit email pass remains separate from account password',async()=>{
 const {parseInput}=await import('../../../shared/importer.mjs'),{classifyRecords}=await import('../../../shared/classifier.mjs');
 const parsed=await parseInput({bytes:Buffer.from('id:10001|password:ACCOUNT_DEMO|email:one@example.test|email pass:MAIL_DEMO'),originalName:'synthetic.txt'},{classification:true});
 const row=classifyRecords(parsed).records[0];assert.equal(row.data.emailPassword,'MAIL_DEMO');assert.equal(row.data.password,'ACCOUNT_DEMO');
});
test('settings: new store enables the three tools',()=>{
 const s=require('../../../electron/local/settings.cjs').getSettings({get:()=>undefined});
 assert.deepEqual([s.proxyEnabled,s.facebookEnabled,s.newsEnabled],[true,true,true]);
});
test('facebook: bare HTTP403 is not evidence of unavailable target content',()=>{
 const target=require('../../../electron/features/facebook/normalize.cjs').normalizeTarget('123');
 const result=require('../../../electron/features/facebook/inspect.cjs').inspectResponse(target,{status:403,body:''});
 assert.equal(result.availability,'unknown');
});
