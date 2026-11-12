const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {openStore}=require('../../electron/local/store.cjs');
const {getSettings,updateSettings}=require('../../electron/local/settings.cjs');
function root(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'blego-store-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('settings_survive_reopen and transaction rollback',async t=>{
 const p=root(t);let s=await openStore(p);updateSettings(s,{country:'GB',symbols:'★'});
 assert.throws(()=>s.transaction(()=>{s.set('other',1);throw Error('fault');}));assert.equal(s.get('other'),undefined);
 s.close();s=await openStore(p);assert.equal(getSettings(s).country,'GB');assert.equal(getSettings(s).symbols,'★');s.close();
});
test('failed_migration_preserves_previous_store',async t=>{
 const p=root(t);let s=await openStore(p);s.set('proof','retained');s.close();
 await assert.rejects(openStore(p,{migrations:[db=>{db.exec('DROP TABLE kv');throw Error('fault');}]}));
 s=await openStore(p);assert.equal(s.get('proof'),'retained');s.close();assert.ok(fs.readdirSync(p).some(x=>x.endsWith('.backup')));
});
test('missing established registry is not silently recreated',async t=>{
 const p=root(t);const s=await openStore(p);s.close();fs.unlinkSync(path.join(p,'local.sqlite'));
 await assert.rejects(openStore(p),/STORE_MISSING/);
});
