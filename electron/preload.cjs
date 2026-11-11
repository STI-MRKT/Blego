const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blego', {
  tourSeen: () => ipcRenderer.invoke('tour:seen'),
  markTour: () => ipcRenderer.invoke('tour:mark')
});
