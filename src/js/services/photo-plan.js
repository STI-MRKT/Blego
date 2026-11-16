import { createWorkspaceResolver, engineOperations } from '../../../shared/image-workspace.mjs';
// A preview uses a detached workspace: typing never commits per-file edits or exports.
export function imageDraftPlan(workspace, {fileIds, operations, touched=[], excludedGps=[], target='selection', groupId='ungrouped'}) {
 const draft=structuredClone(workspace);
 if(target==='group'){const group=draft.groups.find(g=>g.id===groupId);group.operations=[...group.operations.filter(op=>!operations.some(next=>next.field===op.field)),...operations];}
 else for(const id of fileIds){
  const updates=fileIds.length>1?operations.filter(op=>touched.includes(op.field)&&!(op.field==='gps'&&excludedGps.includes(id))):operations;
  draft.overrides[id]=[...(draft.overrides[id]||[]).filter(op=>!updates.some(next=>next.field===op.field)),...updates];
 }
 const resolve=createWorkspaceResolver(draft);
 const batches=new Map();
 for(const id of fileIds){const operations=engineOperations(resolve(id)),key=JSON.stringify(operations);if(!batches.has(key))batches.set(key,{fileIds:[],operations});batches.get(key).fileIds.push(id);}
 return {workspace:draft,batches:[...batches.values()]};
}
export const hasImageChanges=plan=>plan?.files.some(file=>file.beforeAfter.some(row=>row.operation!=='keep'&&row.supported!==false&&JSON.stringify(row.before)!==JSON.stringify(row.after)));
