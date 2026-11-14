const { contextBridge, ipcRenderer, webUtils } = require('electron');
async function call(name, arg) {
  const r = await ipcRenderer.invoke(`local:${name}`, arg);
  if (!r.ok) throw Object.assign(Error(r.code), { details: r.details });
  return r.value;
}
contextBridge.exposeInMainWorld('blego', {
  onBeforeClose: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('local:before-close', listener);
    return () => ipcRenderer.removeListener('local:before-close', listener);
  },
  closeGuardReady: () => call('closeGuardReady'),
  finishClose: (result) => call('finishClose', result),
  friendsList: () => call('friendsList'),
  importFriends: () => call('friendsImport'),
  confirmFriends: (token) => call('friendsConfirm', token),
  cancelFriends: (token) => call('friendsCancel', token),
  openFriend: (id) => call('friendsOpen', id),
  prepareGroupExport: (request) => call('imageGroupPrepare', request),
  cancelGroupExport: (request) => call('imageGroupCancel', request),
  imageExportHistory: () => call('imageExportHistory'),
  imageWorkspace: () => call('imageWorkspace'),
  changeImageWorkspace: (request) => call('imageWorkspaceChange', request),
  chooseImageReference: () => call('imageReferenceChoose'),
  imageReferenceOperations: (request) => call('imageReferenceOperations', request),
  manageMetadataPreset: (request) => call('metadataPresetManage', request),
  chooseImageDestination: () => call('imagesDestination'),
  applyMetadataPlan: (request) => call('imagesApply', request),
  cancelImageExport: () => call('imagesCancel'),
  exportMetadataReport: (format) => call('imagesReport', format),
  onImageProgress: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('local:image-progress', listener);
    return () => ipcRenderer.removeListener('local:image-progress', listener);
  },
  copyImage: (id) => call('imageCopy', id),
  chooseImages: () => call('imagesChoose'),
  chooseImageFolders: () => call('imagesFolders'),
  onImageScan: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('local:image-scan', listener);
    return () => ipcRenderer.removeListener('local:image-scan', listener);
  },
  addDroppedImages: (files) =>
    call(
      'imagesAddDropped',
      Array.from(files, (file) => webUtils.getPathForFile(file))
    ),
  geoCatalog: (request) => call('geoCatalog', request),
  geoBoundary: (request) => call('geoBoundary', request),
  mapTile: (request) => call('mapTile', request),
  cancelMapTile: (id) => call('cancelMapTile', id),
  moveImageGeo: (request) => call('imagesMoveGeo', request),
  generateImageGeo: (request) => call('imagesGenerateGeo', request),
  cancelGeo: (id) => call('geoCancel', id),
  importGeo: () => call('geoImport'),
  confirmGeoImport: (token) => call('geoImportConfirm', token),
  readImageMetadata: (id) => call('imageRead', id),
  previewImage: (fileId, thumbnail = false) => call('imagePreview', { fileId, thumbnail }),
  planMetadataChanges: (request) => call('imagesPlan', request),
  clearImages: () => call('imagesClear'),
  removeImage: (id) => call('imageRemove', id),
  metadataPresets: () => call('metadataPresets'),
  saveMetadataPreset: (preset) => call('metadataPresetSave', preset),
  importMetadataPreset: () => call('metadataPresetImport'),
  linkFacebookImport: (request) => call('facebookLinkImport', request),
  normalizeFacebook: (text) => call('facebookNormalize', text),
  checkFacebook: (request) => call('facebookCheck', request),
  cancelFacebook: () => call('facebookCancel'),
  saveFacebookNote: (note) => call('facebookNote', note),
  openFacebook: (target) => call('facebookOpen', target),
  onFacebookResult: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('local:facebook-result', listener);
    return () => ipcRenderer.removeListener('local:facebook-result', listener);
  },
  newsSnapshot: (topic) => call('newsSnapshot', topic),
  refreshNews: (options) => call('newsRefresh', options),
  cancelNews: () => call('newsCancel'),
  onNews: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('local:news-updated', listener);
    return () => ipcRenderer.removeListener('local:news-updated', listener);
  },
  checkProxy: (request) => call('proxyCheck', request),
  cancelProxy: () => call('proxyCancel'),
  saveProxyKey: (value) => call('proxyKey', value),
  listArchives: (q) => call('archiveList', q),
  openArchive: (id) => call('archiveOpen', id),
  saveArchive: (id) => call('archiveSave', id),
  exportArchive: (arg) => call('archiveExport', arg),
  removeArchive: (id) => call('archiveRemove', id),
  archiveFolder: (id) => call('archiveFolder', id),
  readInput: (arg) => call('importRead', arg),
  importPage: (arg) => call('importPage', arg),
  reclassify: (arg) => call('importReclassify', arg),
  importCell: (arg) => call('importCell', arg),
  classifierExportText: (arg) => call('importExportText', arg),
  classifierExportFile: (arg) => call('importExportFile', arg),
  cancelImport: (id) => call('importCancel', id),
  importText: (id) => call('importText', id),
  copyPreferences: () => call('copyPreferences'),
  saveCopyPreferences: (preferences) => call('copyPreferencesSave', preferences),
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
  biography: (request) => call('biography', request),
  clearCard: () => call('clearCard'),
  tourSeen: () => call('tourSeen'),
  markTour: () => call('tourMark'),
  getSettings: () => call('settingsGet'),
  updateSettings: (patch) => call('settingsUpdate', patch),
  chooseArchiveDirectory: () => call('archiveDirectory'),
  copyText: (text) => call('copy', text)
});
