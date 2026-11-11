const { app, BrowserWindow, Menu, shell, screen, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./server.cjs');

let serverInstance = null;
let serverUrl = null;

const statePath = () => path.join(app.getPath('userData'), 'blego-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(patch) {
  const next = { ...readState(), ...patch };
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(next));
}

ipcMain.handle('tour:seen', () => Boolean(readState().tourSeen));
ipcMain.handle('tour:mark', () => {
  writeState({ tourSeen: true });
  return true;
});

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
  window.once('ready-to-show', () => window.show());
  window.loadURL(url);
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
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
  app.whenReady().then(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    if (serverInstance) serverInstance.close();
  });
}
