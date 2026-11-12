const {Worker}=require('node:worker_threads');const path=require('node:path');const {randomUUID}=require('node:crypto');
function createClassificationService({allowTestRules=false,clock=()=>new Date()}={}){
 const operations=new Map(),jobs=new Map();
 function get(id){const o=operations.get(id);if(!o)throw Error('UNKNOWN_OPERATION');return o;}
 function classifyDocument(parsed,rules=null){
  if(rules&&(!allowTestRules||rules.testOnly!==true))throw Error('RULES_NOT_CONFIGURED');
  const operationId=randomUUID();const base={operationId,status:'rules_pending',rulesVersion:null,records:[],unresolved:parsed.records,diagnostics:parsed.diagnostics,counts:parsed.counts,parsed,sessionStartedAt:clock().toISOString()};
  if(rules){const records=[],unresolved=[];for(const r of parsed.records){const value=rules.classify(r);if(value===null)unresolved.push(r);else if(typeof value==='string')records.push({id:r.id,text:value});else throw Error('INVALID_RULE_RESULT');}
   Object.assign(base,{status:unresolved.length?'preview_partial':'preview_complete',rulesVersion:rules.version,testOnly:true,records,unresolved,resultText:records.map(r=>r.text).join('\n'),unresolvedText:unresolved.map(r=>JSON.stringify(r.raw)).join('\n'),counts:{...parsed.counts,processed:records.length,unresolved:unresolved.length}});
  }
  operations.set(operationId,base);return publicResult(base);
 }
 function publicResult(o){return {operationId:o.operationId,status:o.status,rulesVersion:o.rulesVersion,counts:o.counts,processedAt:o.processedAt,encoding:o.parsed.encoding,encodingAssumed:o.parsed.encodingAssumed,originalName:o.parsed.originalName};}
 async function read(input,options={}){
  if(!input||typeof input.requestId!=='string'||input.requestId.length>100||jobs.has(input.requestId)||!(input.bytes instanceof Uint8Array)||input.bytes.byteLength>50*1024*1024||typeof input.originalName!=='string'||input.originalName.length>255)throw Error('INVALID_INPUT');
  // Bound retained in-memory input; explicit discard releases the previous document.
  if(jobs.size>=2||operations.size>=4)throw Error('TOO_MANY_OPERATIONS');
  const worker=new Worker(path.join(__dirname,'worker.cjs'),{workerData:{input,options:{format:options.format,encoding:options.encoding}},resourceLimits:{maxOldGenerationSizeMb:512}});
  const parsed=await new Promise((resolve,reject)=>{jobs.set(input.requestId,{worker,reject});worker.once('message',r=>r.ok?resolve(r.value):reject(Error(r.code)));worker.once('error',()=>reject(Error('PARSE_FAILED')));worker.once('exit',code=>{if(code)reject(Error('PARSE_FAILED'));});}).finally(()=>{jobs.delete(input.requestId);worker.terminate();});
  return classifyDocument(parsed,null);
 }
 function confirmClassification(id,decision){const o=get(id);if(['completed','partial_confirmed'].includes(o.status))return publicResult(o);if(o.status==='preview_complete'&&decision==='accept_complete')o.status='completed';else if(o.status==='preview_partial'&&decision==='accept_partial')o.status='partial_confirmed';else throw Error('INVALID_CONFIRMATION');o.processedAt=clock().toISOString();o.timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;o.offsetMinutes=-new Date(o.processedAt).getTimezoneOffset();return publicResult(o);}
 function getConfirmed(id){const o=get(id);if(!['completed','partial_confirmed'].includes(o.status))throw Error('NOT_CLASSIFIED');return structuredClone(o);}
 function page(id,offset=0){if(!Number.isInteger(offset)||offset<0)throw Error('INVALID_PAGE');const o=get(id),p=o.parsed;return {...publicResult(o),columns:p.columns,delimiter:p.delimiter,offset,records:p.records.slice(offset,offset+50),diagnostics:o.diagnostics.filter(d=>!d.recordId||p.records.slice(offset,offset+50).some(r=>r.id===d.recordId)).slice(0,200)};}
 function cancel(id){const job=jobs.get(id);if(job){job.reject(Error('CANCELLED'));job.worker.terminate();jobs.delete(id);}operations.delete(id);return true;}
 return {read,classifyDocument,confirmClassification,getConfirmed,page,cancel,sourceText:id=>get(id).parsed.text,close(){for(const id of jobs.keys())cancel(id);operations.clear();}};
}
module.exports={createClassificationService};
