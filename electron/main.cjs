const { app, BrowserWindow, Menu, shell, screen, ipcMain, clipboard, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./server.cjs');

let serverInstance = null;
let serverUrl = null;

const { openStore } = require('./local/store.cjs');
const { getSettings, updateSettings } = require('./local/settings.cjs');
const { registerIpc, externalUrl, copyText } = require('./local/ipc.cjs');
const { generateProfile, clearCard } = require('./features/generator/service.cjs');
const { resolvePreset } = require('./features/generator/sources.cjs');
const { createClassificationService } = require('./features/classification/service.cjs');
const classification = createClassificationService();
const { createArchiveService } = require('./features/archive/service.cjs');
const { checkProxy } = require('./features/proxy/service.cjs');
let proxyController = null;
const { createNewsService } = require('./features/news/service.cjs');
let store, mainWindow, archives, news;
let recoveryReports = [];
async function initialize() {
  store = await openStore(app.getPath('userData'));
  archives = createArchiveService({ store, classification });
  news = createNewsService({
    store,
    onUpdate: (snapshot) => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('local:news-updated', snapshot);
    }
  });
  news.configure();
  const roots = new Set([
    getSettings(store).archiveRoot || path.join(store.root, 'archives'),
    ...store.db
      .prepare('SELECT metadata FROM archives')
      .all()
      .map((r) => JSON.parse(r.metadata).archiveRoot)
  ]);
  for (const root of roots) {
    try {
      recoveryReports.push(await archives.recover(root));
    } catch {
      recoveryReports.push({ recovered: 0, errors: [{ code: 'ARCHIVE_ROOT_UNAVAILABLE' }] });
    }
  }
  // Preserve the existing onboarding marker; no legacy user file is removed.
  if (store.get('tourSeen') === undefined) {
    try {
      store.set(
        'tourSeen',
        !!JSON.parse(
          fs.readFileSync(path.join(app.getPath('userData'), 'blego-state.json'), 'utf8')
        ).tourSeen
      );
    } catch {
      /* absent legacy marker */
    }
  }
  registerIpc(
    ipcMain,
    () => mainWindow,
    () => serverUrl,
    {
      settingsGet: () => getSettings(store),
      newsSnapshot: () => news.snapshot(),
      newsRefresh: (options) => news.refreshNews(options || {}),
      newsCancel: () => news.cancel(),
      proxyCheck: async (request) => {
        if (!getSettings(store).proxyEnabled) throw Error('MODULE_DISABLED');
        if (proxyController) throw Error('CHECK_RUNNING');
        const c = new AbortController();
        proxyController = c;
        try {
          return await checkProxy(request, c.signal);
        } finally {
          if (proxyController === c) proxyController = null;
        }
      },
      proxyCancel: () => {
        proxyController?.abort();
        return true;
      },
      archiveList: (q) => ({ ...archives.listArchives(q), recoveryReports }),
      archiveOpen: async (id) => {
        const r = await archives.openArchive(id);
        return {
          entry: r.entry,
          resultText: r.entries['result.txt'].toString(),
          unresolvedText: r.entries['unresolved.txt']?.toString() || '',
          diagnostics: r.entries['diagnostics.jsonl'].toString()
        };
      },
      archiveSave: (id) => {
        const s = getSettings(store);
        return archives.saveArchive(id, {
          archiveRoot: s.archiveRoot,
          includeOriginal: s.includeOriginal
        });
      },
      archiveExport: async (arg) => {
        const e = archives.entry(arg.id);
        const r = await dialog.showSaveDialog(mainWindow, {
          defaultPath: arg.text ? 'result.txt' : e.fileName
        });
        if (r.canceled) return { ok: false, code: 'CANCELLED' };
        return archives.exportArchive(arg.id, r.filePath, { text: arg.text === true });
      },
      archiveRemove: async (id) => {
        archives.entry(id);
        const r = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          message: 'Delete this archive? The generator uniqueness history will remain.',
          buttons: ['Cancel', 'Delete'],
          defaultId: 0,
          cancelId: 0
        });
        return r.response === 1 ? archives.removeArchive(id) : false;
      },
      archiveFolder: (id) => {
        const e = archives.entry(id);
        shell.showItemInFolder(path.join(e.archiveRoot, e.fileName));
        return true;
      },
      importRead: (arg) => classification.read(arg, { encoding: arg.encoding || undefined }),
      importPage: (arg) => classification.page(arg.operationId, arg.offset),
      importCancel: (id) => classification.cancel(id),
      importCopy: (id) => copyText(classification.sourceText(id), clipboard),
      classificationConfirm: (arg) =>
        classification.confirmClassification(arg.operationId, arg.decision),
      generate: (request) => generateProfile(request, { store }),
      lastCard: () => store.get('lastCard') || null,
      clearCard: () => clearCard(store),
      settingsUpdate: (patch) => {
        if (Object.hasOwn(patch || {}, 'archiveRoot')) throw Error('USE_DIRECTORY_DIALOG');
        const next = { ...getSettings(store), ...patch };
        for (const c of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'])
          for (const t of ['model', 'tech', 'crypto']) resolvePreset(c, t, next);
        const updated = updateSettings(store, patch);
        if (!updated.proxyEnabled) proxyController?.abort();
        news.configure();
        return updated;
      },
      archiveDirectory: async () => {
        const r = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        });
        return r.canceled
          ? getSettings(store)
          : updateSettings(store, { archiveRoot: r.filePaths[0] });
      },
      copy: (text) => copyText(text, clipboard),
      tourSeen: () => !!store.get('tourSeen'),
      tourMark: () => {
        store.set('tourSeen', true);
        return true;
      }
    }
  );
  await createWindow();
}

async function ensureServer() {
  if (!serverUrl) {
    const started = await startServer(path.join(__dirname, '..', 'src'), 0, {
      networkEnabled: () => getSettings(store).proxyEnabled
    });
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
  window.webContents.on('will-navigate', (event, target) => {
    if (target !== url) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  );
  window.once('ready-to-show', () => window.show());
  window.loadURL(url);
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    const safe = externalUrl(target);
    if (safe) shell.openExternal(safe).catch(() => {});
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
  app
    .whenReady()
    .then(initialize)
    .catch(() => {
      dialog.showErrorBox(
        'BLEGO',
        'Local storage could not be opened. Restore its backup; no new history was created.'
      );
      app.quit();
    });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    if (serverInstance) serverInstance.close();
    proxyController?.abort();
    news?.close();
    classification.close();
    if (store) store.close();
  });
}
