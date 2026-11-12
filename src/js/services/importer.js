import {parseText} from '../../../shared/importer.mjs';
export function parseFile(text,extension){try{const p=parseText(text,extension);return {...p,rows:p.records.map(r=>({data:Object.fromEntries(Object.entries(r.data).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v??'')])),issues:p.diagnostics.filter(d=>d.recordId===r.id).map(d=>d.code),level:p.diagnostics.some(d=>d.recordId===r.id)?'warn':'ok'}))};}catch(e){return {error:e.code||'PARSE_FAILED'};}}
export function importErrorMessage(code){return `File could not be read: ${code}. Supported: TXT, CSV, TSV, JSON, up to 50 MiB. Select the source encoding explicitly if needed.`;}
export const issueText=code=>code;
