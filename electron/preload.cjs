const { contextBridge, ipcRenderer } = require('electron');
async function call(name,arg){const r=await ipcRenderer.invoke(`local:${name}`,arg);if(!r.ok)throw Error(r.code);return r.value;}
contextBridge.exposeInMainWorld('blego', {
  tourSeen:()=>call('tourSeen'), markTour:()=>call('tourMark'),
  getSettings:()=>call('settingsGet'), updateSettings:patch=>call('settingsUpdate',patch),
  chooseArchiveDirectory:()=>call('archiveDirectory'), copyText:text=>call('copy',text)
});
