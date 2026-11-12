const { contextBridge, ipcRenderer } = require('electron');
async function call(name, arg) {
  const r = await ipcRenderer.invoke(`local:${name}`, arg);
  if (!r.ok) throw Object.assign(Error(r.code), { details: r.details });
  return r.value;
}
contextBridge.exposeInMainWorld('blego', {
  newsSnapshot: () => call('newsSnapshot'),
  refreshNews: (options) => call('newsRefresh', options),
  cancelNews: () => call('newsCancel'),
  onNews: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('local:news-updated', listener);
    return () => ipcRenderer.removeListener('local:news-updated', listener);
  },
  checkProxy: (request) => call('proxyCheck', request),
  cancelProxy: () => call('proxyCancel'),
  listArchives: (q) => call('archiveList', q),
  openArchive: (id) => call('archiveOpen', id),
  saveArchive: (id) => call('archiveSave', id),
  exportArchive: (arg) => call('archiveExport', arg),
  removeArchive: (id) => call('archiveRemove', id),
  archiveFolder: (id) => call('archiveFolder', id),
  readInput: (arg) => call('importRead', arg),
  importPage: (arg) => call('importPage', arg),
  cancelImport: (id) => call('importCancel', id),
  copySource: (id) => call('importCopy', id),
  confirmClassification: (arg) => call('classificationConfirm', arg),
  generate: (request) => call('generate', request),
  getPoolStats: (request) => call('poolStats', request),
  choosePoolPackage: () => call('poolChoose'),
  applyPoolPackage: (token) => call('poolApply', token),
  cancelPoolPackage: (token) => call('poolCancel', token),
  useBundledPool: (country) => call('poolBundled', country),
  selectPoolVersion: (request) => call('poolSelect', request),
  lastCard: () => call('lastCard'),
  clearCard: () => call('clearCard'),
  tourSeen: () => call('tourSeen'),
  markTour: () => call('tourMark'),
  getSettings: () => call('settingsGet'),
  updateSettings: (patch) => call('settingsUpdate', patch),
  chooseArchiveDirectory: () => call('archiveDirectory'),
  copyText: (text) => call('copy', text)
});
