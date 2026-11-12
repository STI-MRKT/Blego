const { contextBridge, ipcRenderer } = require('electron');
async function call(name,arg){const r=await ipcRenderer.invoke(`local:${name}`,arg);if(!r.ok)throw Error(r.code);return r.value;}
contextBridge.exposeInMainWorld('blego', {
  listArchives:q=>call('archiveList',q),openArchive:id=>call('archiveOpen',id),saveArchive:id=>call('archiveSave',id),exportArchive:arg=>call('archiveExport',arg),removeArchive:id=>call('archiveRemove',id),archiveFolder:id=>call('archiveFolder',id),
  readInput:arg=>call('importRead',arg), importPage:arg=>call('importPage',arg), cancelImport:id=>call('importCancel',id), copySource:id=>call('importCopy',id),
  confirmClassification:arg=>call('classificationConfirm',arg),
  generate:request=>call('generate',request), lastCard:()=>call('lastCard'), clearCard:()=>call('clearCard'),
  tourSeen:()=>call('tourSeen'), markTour:()=>call('tourMark'),
  getSettings:()=>call('settingsGet'), updateSettings:patch=>call('settingsUpdate',patch),
  chooseArchiveDirectory:()=>call('archiveDirectory'), copyText:text=>call('copy',text)
});
