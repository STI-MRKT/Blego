const fs=require('node:fs');const path=require('node:path');const {randomUUID}=require('node:crypto');
const {writeZip,readZip}=require('./zip.cjs');const {hash,fileName}=require('./manifest.cjs');
function createArchiveService({store,classification,root=store.root,fault=()=>{}}){
 const active=new Map();const defaultRoot=path.join(root,'archives');
 function row(id){const r=store.db.prepare('SELECT * FROM archives WHERE id=?').get(id);if(!r||r.state!=='ready')throw Error('ARCHIVE_NOT_READY');return {...JSON.parse(r.metadata),archiveId:r.id,fileName:r.file_name};}
 function persist(entry,state){store.db.prepare('INSERT INTO archives(id,operation_id,file_name,state,metadata) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,metadata=excluded.metadata').run(entry.archiveId,entry.operationId,entry.fileName,state,JSON.stringify(entry));}
 async function saveArchive(operationId,options={}){
  if(typeof operationId!=='string')throw Error('INVALID_OPERATION');
  if(active.has(operationId))return active.get(operationId);
  const job=(async()=>{
   const confirmed=classification.getConfirmed(operationId);
   const existing=store.db.prepare('SELECT id,state FROM archives WHERE operation_id=?').get(operationId);
   if(existing){if(existing.state==='ready')return row(existing.id);await recover(options.archiveRoot||defaultRoot);const after=store.db.prepare('SELECT state FROM archives WHERE id=?').get(existing.id);if(after?.state==='ready')return row(existing.id);throw Error('ARCHIVE_RECOVERY_REQUIRED');}
   const archiveRoot=options.archiveRoot||defaultRoot;await fs.promises.mkdir(archiveRoot,{recursive:true,mode:0o700});
   const entries={'result.txt':Buffer.from(confirmed.resultText),'diagnostics.jsonl':Buffer.from(confirmed.diagnostics.map(d=>JSON.stringify(d)).join('\n'))};
   if(confirmed.unresolved.length)entries['unresolved.txt']=Buffer.from(confirmed.unresolvedText);
   if(options.includeOriginal)entries[`source/original.${confirmed.parsed.format}`]=Buffer.from(confirmed.parsed.sourceBytes);
   const manifest={version:1,archiveId:randomUUID(),operationId,originalName:confirmed.parsed.originalName,sourceHash:confirmed.parsed.sourceHash,sourceSize:confirmed.parsed.sourceBytes.byteLength,processedAt:confirmed.processedAt,archivedAt:new Date().toISOString(),sessionStartedAt:confirmed.sessionStartedAt,timeZone:confirmed.timeZone,offsetMinutes:confirmed.offsetMinutes,status:confirmed.status,rulesVersion:confirmed.rulesVersion,testOnly:confirmed.testOnly===true,counts:confirmed.counts,entries:Object.fromEntries(Object.entries(entries).map(([n,b])=>[n,{size:b.length,sha256:hash(b)}]))};
   entries['manifest.json']=Buffer.from(JSON.stringify(manifest,null,2));
   const entry={...manifest,fileName:fileName(manifest),archiveRoot,lastOpenedAt:null,sizes:{source:manifest.sourceSize,result:Buffer.byteLength(confirmed.resultText),compressed:null}};
   const target=path.join(archiveRoot,entry.fileName),temp=target+'.pending';persist(entry,'pending');fault('pending');
   try{fault('writing');await writeZip(temp,entries);await readZip(temp);fault('beforeRename');
    // link+unlink is atomic no-clobber finalization on the same filesystem.
    // Unlike rename(), it cannot overwrite an existing ZIP, even on collision.
    await fs.promises.link(temp,target);await fs.promises.unlink(temp);fault('afterRename');
    entry.sizes.compressed=(await fs.promises.stat(target)).size;persist(entry,'ready');return entry;
   }catch(e){throw Object.assign(Error('ARCHIVE_WRITE_FAILED'),{code:e.code||'ARCHIVE_WRITE_FAILED'});}
  })();active.set(operationId,job);try{return await job;}finally{active.delete(operationId);}
 }
 function listArchives(query={}){
  const q=String(query.search||'').toLocaleLowerCase();let items=store.db.prepare("SELECT id FROM archives WHERE state='ready'").all().map(r=>row(r.id)).filter(r=>r.originalName.toLocaleLowerCase().includes(q)&&(!query.status||r.status===query.status)&&(!query.from||r.processedAt>=query.from)&&(!query.to||r.processedAt<=query.to));
  items.sort((a,b)=>b.processedAt.localeCompare(a.processedAt));if(query.order==='oldest')items.reverse();const offset=Math.max(0,Number(query.offset)||0);return {total:items.length,items:items.slice(offset,offset+50)};
 }
 async function openArchive(id){const entry=row(id);const data=await readZip(path.join(entry.archiveRoot,entry.fileName));if(data.manifest.archiveId!==id)throw Error('ARCHIVE_ID_MISMATCH');entry.lastOpenedAt=new Date().toISOString();persist(entry,'ready');return {...data,entry};}
 async function exportArchive(id,destination,{text=false}={}){const entry=row(id);const checked=await readZip(path.join(entry.archiveRoot,entry.fileName));if(text)await fs.promises.writeFile(destination,checked.entries['result.txt'],{flag:'wx'});else await fs.promises.copyFile(path.join(entry.archiveRoot,entry.fileName),destination,fs.constants.COPYFILE_EXCL);return {ok:true};}
 async function removeArchive(id){const entry=row(id);await fs.promises.unlink(path.join(entry.archiveRoot,entry.fileName));store.db.prepare('DELETE FROM archives WHERE id=?').run(id);return true;}
 async function recover(archiveRoot=defaultRoot){
  await fs.promises.mkdir(archiveRoot,{recursive:true,mode:0o700});let recovered=0;const errors=[];
  for(const name of await fs.promises.readdir(archiveRoot)){
   if(!name.endsWith('.zip'))continue;
   try{const file=path.join(archiveRoot,name),{manifest:m}=await readZip(file);if(fileName(m)!==name)throw Error('INVALID_ARCHIVE_NAME');
    const old=store.db.prepare('SELECT state,metadata FROM archives WHERE id=?').get(m.archiveId);if(old?.state==='ready')continue;
    const entry={...m,fileName:name,archiveRoot,lastOpenedAt:old?JSON.parse(old.metadata).lastOpenedAt:null,sizes:{source:m.sourceSize,result:m.entries['result.txt'].size,compressed:(await fs.promises.stat(file)).size}};persist(entry,'ready');recovered++;
   }catch{errors.push({fileName:name,code:'ARCHIVE_RECOVERY_FAILED'});}
  }
  // Resume only known temporary files; never sweep arbitrary user folders.
  for(const pending of store.db.prepare("SELECT metadata FROM archives WHERE state='pending'").all()){
   const e=JSON.parse(pending.metadata);if(e.archiveRoot!==archiveRoot)continue;
   const temp=path.join(archiveRoot,e.fileName+'.pending'),target=path.join(archiveRoot,e.fileName);
   try{
    if(!fs.existsSync(temp)){errors.push({archiveId:e.archiveId,code:'INCOMPLETE_WRITE'});continue;}
    const {manifest}=await readZip(temp);if(manifest.archiveId!==e.archiveId)throw Error('MISMATCH');
    await fs.promises.link(temp,target);await fs.promises.unlink(temp);e.sizes.compressed=(await fs.promises.stat(target)).size;persist(e,'ready');recovered++;
   }catch{errors.push({archiveId:e.archiveId,code:'INCOMPLETE_WRITE'});}
  }
  return {recovered,errors};
 }
 return {saveArchive,listArchives,openArchive,exportArchive,removeArchive,recover,entry:row};
}
module.exports={createArchiveService};
