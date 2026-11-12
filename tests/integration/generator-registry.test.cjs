const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {openStore}=require('../../electron/local/store.cjs');const {generateProfile,clearCard}=require('../../electron/features/generator/service.cjs');
const relaxed={allowRepeats:['bio','status','postalCode','address','number']};
async function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'blego-gen-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,store:await openStore(root)};}
test('unique_contacts_survive_restart: 10000 artificial-capacity requests',async t=>{
 let {root,store}=await setup(t);const ids=new Set(),phones=new Set(),emails=new Set();
 for(let i=0;i<10000;i++){
 if(i===5000){store.close();store=await openStore(root);}
 const p=await generateProfile({country:'US',type:'tech',requestId:`test-${i}`},{store,settings:relaxed});ids.add(p.id);phones.add(p.fields.phone);emails.add(p.fields.email);
 }assert.equal(ids.size,10000);assert.equal(phones.size,10000);assert.equal(emails.size,10000);store.close();
});
test('parallel requests, idempotent retry, clear and cached provenance',async t=>{
 const {store}=await setup(t);t.after(()=>store.close());
 const req={country:'GB',type:'model',requestId:'retry'};
 const p=await generateProfile(req,{store,settings:relaxed});const retry=await generateProfile(req,{store,settings:relaxed});assert.deepEqual(p,retry);
 const list=await Promise.all(Array.from({length:20},(_,i)=>generateProfile({...req,requestId:`p-${i}`},{store,settings:relaxed,clock:()=>new Date('2026-01-01Z')})));
 assert.equal(new Set(list.map(x=>x.id)).size,20);assert.equal(new Set(list.map(x=>x.fields.phone)).size,20);
 clearCard(store);assert.equal(store.get('lastCard'),null);assert.equal(store.db.prepare("SELECT count(*) n FROM issued WHERE field='phone'").get().n,21);
 assert.deepEqual((await generateProfile(req,{store,settings:{...relaxed,symbols:'new'}})).fields,p.fields);
});
test('small_pool_exhausts_explicitly and failed operation reserves nothing',async t=>{
 const {store}=await setup(t);t.after(()=>store.close());
 const settings={overrides:{common:{bios:['single'],statuses:['single']}}};
 await generateProfile({country:'US',type:'model',requestId:'first'},{store,settings});
 const n=store.db.prepare('SELECT count(*) n FROM issued').get().n;
 await assert.rejects(generateProfile({country:'US',type:'model',requestId:'second'},{store,settings}),/POOL_EXHAUSTED/);
 assert.equal(store.db.prepare('SELECT count(*) n FROM issued').get().n,n);
});
test('every country/type actually issues mandatory contacts',async t=>{
 const {store}=await setup(t);t.after(()=>store.close());
 for(const country of ['BR','US','FR','PL','DE','ES','IT','GB'])for(const type of ['model','tech','crypto']){
 const p=await generateProfile({country,type,requestId:`${country}-${type}`},{store,settings:relaxed});assert.ok(p.fields.phone.startsWith('+'));assert.match(p.fields.email,/@example.com$/);assert.equal(p.type,type);
 }
});
