const {randomUUID,randomInt}=require('node:crypto');
const {resolvePreset}=require('./sources.cjs');const {registry}=require('./registry.cjs');
const {getSettings}=require('../../local/settings.cjs');
function exhausted(field,p){const e=Error(`POOL_EXHAUSTED: ${field} (${p.country}:${p.type})`);e.code='POOL_EXHAUSTED';e.details={field,scope:`${p.country}:${p.type}`};throw e;}
async function generateProfile(request,{store,settings=getSettings(store),clock=()=>new Date()}={}){
 if(!request||typeof request.requestId!=='string'||request.requestId.length>100||!request.requestId)throw Error('INVALID_REQUEST');
 const p=resolvePreset(request.country,request.type,settings);
 return store.transaction(()=>{
  const old=store.db.prepare('SELECT profile FROM requests WHERE request_id=?').get(request.requestId);
  if(old){const profile=JSON.parse(old.profile);if(profile.country!==p.country||profile.type!==p.type)throw Error('REQUEST_CONFLICT');return profile;}
  const r=registry(store,p);const id=randomUUID();const values={};
  const pick=a=>a[randomInt(a.length)];
  const finite=(f,a)=>{const choices=p.allowRepeats.includes(f)?a:a.filter(x=>!r.used(f,x));if(!choices.length)exhausted(f,p);return pick(choices);};
  if(p.pool){
   const row=p.pool.find(row=>['phone','email','handle'].every(f=>!r.used(f,row[f])));
   if(!row)exhausted('pool',p);Object.assign(values,row);
   if(!new RegExp(`^\\+${p.phonePrefix}\\d{${p.phoneDigits}}$`).test(values.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))throw Error('INVALID_POOL_CONTACT');
  }else{
   values.name=`${pick(p.first)} ${pick(p.last)}`;values.handle=`${p.type}.${id.replaceAll('-','')}`;values.email=`${values.handle}@example.com`;
   const counter=store.get(`phone-sequence:${p.phonePrefix}`)||0;
   // Shared dialing codes share a counter across countries/types. No probabilistic retry loop.
   if(counter>=10**(p.phoneDigits-p.nationalPrefix.length))exhausted('phone',p);
   values.phone=`+${p.phonePrefix}${p.nationalPrefix}${String(counter).padStart(p.phoneDigits-p.nationalPrefix.length,'0')}`;
   store.set(`phone-sequence:${p.phonePrefix}`,counter+1);
  }
  const has=f=>p.fieldOrder.includes(f);
  for(const [f,a] of [['bio',p.bios],['status',p.statuses]])if(has(f)&&values[f]===undefined)values[f]=finite(f,a);
  const places=p.places.filter(x=>!has('postalCode')||p.allowRepeats.includes('postalCode')||!r.used('postalCode',x.postal));
  if((has('city')||has('postalCode'))&&!places.length)exhausted('postalCode',p);
  const place=pick(places.length?places:p.places);if(has('city')&&!values.city)values.city=place.city;if(has('postalCode')&&!values.postalCode)values.postalCode=place.postal;
  if(has('address')&&!values.address)values.address=finite('address',p.streets.flatMap(s=>Array.from({length:240},(_,i)=>`${s} ${i+1}`)));
  if(has('number')&&!values.number){const n=store.get(`number:${p.country}`)||0;values.number=String(n).padStart(6,'0');store.set(`number:${p.country}`,n+1);}
  if(has('categories')&&!values.categories)values.categories=p.categories;
  if(has('symbols')&&values.symbols===undefined)values.symbols=p.symbols;
  for(const f of p.fieldOrder)if(values[f]===undefined)throw Error('INCOMPLETE_PROFILE');
  r.reserve('id',id,id);
  for(const f of ['phone','email','handle','bio','status','number','postalCode','address']){
   if(values[f]===undefined||p.allowRepeats.includes(f))continue;
   if(r.used(f,values[f]))exhausted(f,p);r.reserve(f,values[f],id);
  }
  const result={id,country:p.country,type:p.type,fields:values,fieldOrder:p.fieldOrder,rulesVersion:p.rulesVersion,createdAt:clock().toISOString(),uniquenessSummary:{scope:'local installation history',normalization:'NFKC-v1',allowRepeats:p.allowRepeats,capacity:p.capacity,syntheticPhone:true}};
  store.db.prepare('INSERT OR IGNORE INTO rule_versions VALUES(?,?)').run(p.rulesVersion,JSON.stringify(p));
  store.db.prepare('INSERT INTO requests VALUES(?,?,?)').run(request.requestId,id,JSON.stringify(result));
  store.set('lastCard',result);return result;
 });
}
function clearCard(store){store.set('lastCard',null);}
module.exports={generateProfile,clearCard};
