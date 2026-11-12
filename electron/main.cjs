const { app, BrowserWindow, Menu, shell, screen, ipcMain, clipboard, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./server.cjs');

let serverInstance = null;
let serverUrl = null;

const {openStore} = require('./local/store.cjs');
const {getSettings,updateSettings} = require('./local/settings.cjs');
const {registerIpc,externalUrl,copyText} = require('./local/ipc.cjs');
let store, mainWindow;
async function initialize() {
  store = await openStore(app.getPath('userData'));
  // Preserve the existing onboarding marker; no legacy user file is removed.
  if (store.get('tourSeen') === undefined) {
    try { store.set('tourSeen', !!JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'blego-state.json'),'utf8')).tourSeen); } catch { /* absent legacy marker */ }
  }
  registerIpc(ipcMain,()=>mainWindow,()=>serverUrl,{
    settingsGet:()=>getSettings(store),
    settingsUpdate:patch=>{if(Object.hasOwn(patch||{},'archiveRoot'))throw Error('USE_DIRECTORY_DIALOG');return updateSettings(store,patch);},
    archiveDirectory:async()=>{const r=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory','createDirectory']});return r.canceled?getSettings(store):updateSettings(store,{archiveRoot:r.filePaths[0]});},
    copy:text=>copyText(text,clipboard),
    tourSeen:()=>!!store.get('tourSeen'),
    tourMark:()=>{store.set('tourSeen',true);return true;}
  });
  await createWindow();
}

async function ensureServer() {
  if (!serverUrl) {
    const started = await startServer(path.join(__dirname, '..', 'src'));
    serverInstance = started.server;
    serverUrl = started.url;
  }
  return serverUrl;
}

async function createWindow() {
  const url = await ensureServer();
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1380, Math.max(860, area.width - 48));
  const height = Math.min(900, Math.max(520, area.height - 48));
  const window = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(900, width),
    minHeight: Math.min(560, height),
    title: 'BLEGO',
    backgroundColor: '#eceef3',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  mainWindow = window;
  window.webContents.on('will-navigate', (event, target) => { if(target !== url) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.once('ready-to-show', () => window.show());
  window.loadURL(url);
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    const safe=externalUrl(target);
    if(safe) shell.openExternal(safe).catch(()=>{});
    return { action: 'deny' };
  });
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(initialize).catch(()=>{dialog.showErrorBox('BLEGO','Local storage could not be opened. Restore its backup; no new history was created.');app.quit();});
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    if (serverInstance) serverInstance.close();
    if(store) store.close();
  });
}
