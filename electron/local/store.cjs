const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('node:fs');const path=require('node:path');
const initial=require('./migrations/001.cjs');
async function openStore(root,{migrations=[]}={}){
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 const file=path.join(root,'local.sqlite'),marker=path.join(root,'store-established');
 if(fs.existsSync(marker)&&!fs.existsSync(file)) throw Error('STORE_MISSING: restore the local database backup');
 const db=new DatabaseSync(file);
 try{
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw Error('STORE_CORRUPT');
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  const steps=[initial,...migrations];
  // Unknown future versions must never be downgraded.
  if(version>steps.length) throw Error('STORE_NEWER_VERSION');
  if(version && version<steps.length){
   const dest=path.join(root,`migration-${version}-${Date.now()}.backup`);await backup(db,dest);
   const copy=new DatabaseSync(dest,{readOnly:true});try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('BACKUP_INVALID');}finally{copy.close();}
  }
  db.exec('BEGIN IMMEDIATE');
  try{for(let i=version;i<steps.length;i++){steps[i](db);db.exec(`PRAGMA user_version=${i+1}`);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  fs.writeFileSync(marker,'1',{mode:0o600});
  return {db,root,get(key){const r=db.prepare('SELECT value FROM kv WHERE key=?').get(key);return r?JSON.parse(r.value):undefined;},
   set(key,value){db.prepare('INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));},
   transaction(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();if(r&&typeof r.then==='function')throw Error('ASYNC_TRANSACTION_NOT_ALLOWED');db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},
   backup:dest=>backup(db,dest),close(){db.close();}};
 }catch(e){db.close();throw e;}
}
module.exports={openStore};
