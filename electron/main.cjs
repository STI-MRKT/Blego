const {
  app,
  BrowserWindow,
  Menu,
  shell,
  screen,
  ipcMain,
  clipboard,
  dialog,
  nativeImage,
  safeStorage
} = require('electron');
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
const {
  createPoolCatalog,
  getPoolStats,
  loadDataset
} = require('./features/generator/catalog.cjs');
const { createClassificationService } = require('./features/classification/service.cjs');
const classification = createClassificationService();
const { createArchiveService } = require('./features/archive/service.cjs');
const { checkProxy } = require('./features/proxy/service.cjs');
const { secretVault } = require('./local/secrets.cjs');
const { createProxycheckProvider } = require('./features/proxy/proxycheck.cjs');
let vault, reputationProvider;
let proxyController = null;
const { createNewsService } = require('./features/news/service.cjs');
const { normalizeFacebookTargets, normalizeTarget } = require('./features/facebook/normalize.cjs');
const { createFacebookService } = require('./features/facebook/service.cjs');
const { createImageService } = require('./features/images/service.cjs');
let store, mainWindow, archives, news, poolCatalog, facebook, images, geo, friends;
let recoveryReports = [];
let imageExportPromise = null,
  imageExportReport = null;
async function initialize() {
  store = await openStore(app.getPath('userData'));
  vault = secretVault(store, safeStorage);
  reputationProvider = createProxycheckProvider({ getKey: () => vault.get('proxycheck') });
  poolCatalog = createPoolCatalog({ store });
  facebook = createFacebookService({ store });
  friends = require('./features/friends/service.cjs').createFriendsService({ store });
  geo = require('./features/geo/service.cjs').createGeoService({ store });
  images = createImageService({ store, geo });
  await images.recover();
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
  let lastImageScanProgress = 0;
  const imageScanProgress = (progress) => {
    const now = Date.now();
    if (progress.phase !== 'complete' && now - lastImageScanProgress < 80) return;
    lastImageScanProgress = now;
    mainWindow?.webContents.send('local:image-scan', progress);
  };
  registerIpc(
    ipcMain,
    () => mainWindow,
    () => serverUrl,
    {
      settingsGet: () => getSettings(store),
      friendsList: () => friends.list(),
      friendsImport: async () => {
        const chosen = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'Friends', extensions: ['txt', 'csv', 'json'] }]
        });
        if (chosen.canceled) return null;
        let bytes;
        try {
          bytes = await require('./features/images/files.cjs').readBounded(chosen.filePaths[0], {
            maxBytes: 5 * 1024 * 1024
          });
        } catch (error) {
          if (error.message === 'IMAGE_TOO_LARGE') throw Error('FRIENDS_INPUT_LIMIT');
          throw error;
        }
        return friends.preview({ bytes, name: path.basename(chosen.filePaths[0]) });
      },
      friendsConfirm: (token) => friends.confirm(token),
      friendsCancel: (token) => friends.cancel(token),
      friendsOpen: (id) => shell.openExternal(friends.openUrl(id)),
      geoCatalog: (request) => geo.catalog(request),
      geoBoundary: (request) => geo.boundary(request),
      imagesMoveGeo: (request) => images.moveGeo(request),
      imagesGenerateGeo: (request) => images.generateGeo(request),
      geoCancel: (id) => geo.cancel(id),
      geoImport: async () => {
        const chosen = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'City boundaries', extensions: ['json'] }]
        });
        if (chosen.canceled) return null;
        const bytes = await require('./features/images/files.cjs').readBounded(chosen.filePaths[0]);
        return geo.previewImport(bytes);
      },
      geoImportConfirm: (token) => geo.confirmImport(token),
      imagesAddDropped: (paths) => images.addFiles(paths, { onProgress: imageScanProgress }),
      imageWorkspace: () => images.groups.snapshot(),
      imageWorkspaceChange: ({ action, ...request }) => {
        const allowed = [
          'createGroup',
          'renameGroup',
          'removeGroup',
          'moveFiles',
          'setGroupOperations',
          'setFileOverrides',
          'select',
          'save'
        ];
        if (!allowed.includes(action)) throw Error('INVALID_WORKSPACE_ACTION');
        const result = images.groups[action](request);
        return { result, workspace: images.groups.snapshot() };
      },
      imageReferenceChoose: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'Reference image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
        });
        return result.canceled ? null : images.addReference(result.filePaths[0]);
      },
      imageReferenceOperations: (request) => images.referenceOperations(request),
      metadataPresetManage: async (request) => {
        const result = images.managePreset(request);
        if (request.action === 'export') {
          const output = await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'BLEGO-metadata-preset.json'
          });
          if (output.canceled) return false;
          await fs.promises.writeFile(output.filePath, JSON.stringify(result, null, 2), {
            flag: 'wx',
            mode: 0o600
          });
          return true;
        }
        return result;
      },
      imagesChoose: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
            { name: 'All files', extensions: ['*'] }
          ]
        });
        return result.canceled
          ? []
          : images.addFiles(result.filePaths, { onProgress: imageScanProgress });
      },
      imagesFolders: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'multiSelections']
        });
        return result.canceled
          ? []
          : images.addFiles(result.filePaths, { onProgress: imageScanProgress });
      },
      imagesDestination: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory', 'createDirectory']
        });
        return result.canceled ? null : images.addDestination(result.filePaths[0]);
      },
      imageGroupPrepare: (request) => images.prepareGroupExport(request),
      imageGroupCancel: (request) => images.cancelGroupExport(request),
      imageExportHistory: () => images.exportHistory(),
      imagesApply: async (request) => {
        if (imageExportPromise) throw Error('IMAGES_BUSY');
        imageExportPromise = (
          request.runId
            ? images.applyGroupExport.bind(images)
            : images.applyMetadataPlan.bind(images)
        )(request, (result) => {
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('local:image-progress', result);
        });
        try {
          imageExportReport = await imageExportPromise;
          return imageExportReport;
        } finally {
          imageExportPromise = null;
        }
      },
      imagesCancel: () => {
        images.cancelExport();
        images.cancelReads();
        return true;
      },
      imagesReport: async (format) => {
        if (!imageExportReport || !['json', 'txt'].includes(format)) throw Error('INVALID_REPORT');
        const result = await dialog.showSaveDialog(mainWindow, {
          defaultPath: `BLEGO-metadata-report.${format}`
        });
        if (result.canceled) return false;
        const text =
          format === 'json'
            ? JSON.stringify(imageExportReport, null, 2)
            : imageExportReport.files
                .map((f) =>
                  [f.name, f.status, f.outputName || '', f.error || '', ...(f.warnings || [])].join(
                    ' · '
                  )
                )
                .join('\n');
        await fs.promises.writeFile(result.filePath, text, { flag: 'wx', mode: 0o600 });
        return true;
      },
      imageCopy: async (id) =>
        require('./local/ipc.cjs').copyImage(
          nativeImage.createFromBuffer(await images.clipboardPNG(id)),
          clipboard
        ),
      imageRead: (id) => images.readImageMetadata(id),
      imagePreview: (request) =>
        typeof request === 'string'
          ? images.preview(request)
          : images.preview(request?.fileId, { thumbnail: request?.thumbnail === true }),
      imagesPlan: (request) => images.planMetadataChanges(request),
      imagesClear: () => {
        images.clear();
        return true;
      },
      imageRemove: (id) => {
        images.remove(id);
        return true;
      },
      metadataPresets: () => images.presets(),
      metadataPresetSave: (preset) => images.importPreset(preset),
      metadataPresetImport: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'Metadata preset', extensions: ['json'] }]
        });
        if (result.canceled) return null;
        const file = result.filePaths[0];
        if (fs.statSync(file).size > 128 * 1024) throw Error('METADATA_INVALID_PRESET');
        return images.importPreset(JSON.parse(await fs.promises.readFile(file, 'utf8')));
      },
      facebookNormalize: (text) => {
        const result = normalizeFacebookTargets(text);
        return {
          ...result,
          importedFacts: Object.fromEntries(
            result.targets.map((target) => [
              target.canonicalUrl,
              facebook.importedFacts(target.canonicalUrl)
            ])
          ),
          manualNotes: Object.fromEntries(
            result.targets.map((target) => [
              target.canonicalUrl,
              facebook.notes(target.canonicalUrl)
            ])
          )
        };
      },
      facebookCheck: async (request) => {
        if (!getSettings(store).facebookEnabled) throw Error('MODULE_DISABLED');
        const results = [];
        for await (const result of facebook.check(request)) {
          results.push(result);
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('local:facebook-result', result);
        }
        return { runId: request.runId, results };
      },
      facebookCancel: () => {
        facebook.cancel();
        return true;
      },
      facebookLinkImport: ({ operationId, recordId }) => {
        const id = classification.cell(operationId, recordId, 'accountId');
        const profile = classification.cell(operationId, recordId, 'profileUrl');
        const target = normalizeTarget(id || profile);
        if (id && profile && normalizeTarget(profile).canonicalUrl !== target.canonicalUrl)
          throw Error('FB_IDENTITY_CONFLICT');
        const fact = facebook.linkImportedFacts({
          targetKey: target.canonicalUrl,
          name: classification.cell(operationId, recordId, 'fullName'),
          avatarUrl: classification.cell(operationId, recordId, 'avatarUrl'),
          recordId
        });
        return { target: target.canonicalUrl, fact };
      },
      facebookNote: (note) => facebook.saveManualNote(note),
      facebookOpen: (target) => shell.openExternal(normalizeTarget(target).canonicalUrl),
      newsSnapshot: (topic) => news.snapshot(topic),
      newsRefresh: (options) => news.refreshNews(options || {}),
      newsCancel: () => news.cancel(),
      proxyCheck: async (request) => {
        if (!getSettings(store).proxyEnabled) throw Error('MODULE_DISABLED');
        if (proxyController) throw Error('CHECK_RUNNING');
        const c = new AbortController();
        proxyController = c;
        try {
          return await checkProxy(request, c.signal, {
            providers: request?.reputation === true ? [reputationProvider] : []
          });
        } finally {
          if (proxyController === c) proxyController = null;
        }
      },
      proxyKey: (value) => {
        if (
          typeof value !== 'string' ||
          (value && !/^[a-zA-Z0-9]{6}(?:-[a-zA-Z0-9]{6}){3}$/.test(value))
        )
          throw Error('INVALID_KEY');
        vault.set('proxycheck', value);
        reputationProvider.clear();
        return true;
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
          includeOriginal:
            classification.getConfirmed(id).rulesVersion === 'synthetic-records-1'
              ? false
              : s.includeOriginal
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
      importRead: (arg) =>
        classification.read(arg, { ...arg.options, encoding: arg.encoding || undefined }),
      importPage: (arg) => classification.page(arg.operationId, arg.offset, arg.options),
      importReclassify: (arg) => classification.reclassify(arg.operationId, arg.options),
      importCell: (arg) => classification.cell(arg.operationId, arg.recordId, arg.field),
      importExportText: (arg) =>
        classification.exportText(arg.operationId, { recordId: arg.recordId, format: arg.format }),
      importExportFile: async (arg) => {
        if (!['tsv', 'csv'].includes(arg.format)) throw Error('INVALID_FORMAT');
        const choice = await dialog.showSaveDialog(mainWindow, {
          defaultPath: `BLEGO-result.${arg.format}`,
          filters: [{ name: arg.format.toUpperCase(), extensions: [arg.format] }]
        });
        if (choice.canceled) return { ok: false, code: 'CANCELLED' };
        const text = await classification.exportText(arg.operationId, { format: arg.format });
        await fs.promises.writeFile(choice.filePath, text, { flag: 'wx', mode: 0o600 });
        return { ok: true };
      },
      importCancel: (id) => classification.cancel(id),
      importText: (id) => classification.sourceText(id),
      copyPreferences: () => store.get('copy:preferences') || {},
      copyPreferencesSave: (preferences) => {
        if (
          !preferences ||
          typeof preferences !== 'object' ||
          Array.isArray(preferences) ||
          JSON.stringify(preferences).length > 16384
        )
          throw Error('INVALID_SETTINGS');
        for (const [key, value] of Object.entries(preferences)) {
          if (
            !/^[a-zA-Z0-9_-]{1,60}$/.test(key) ||
            ['__proto__', 'constructor', 'prototype'].includes(key) ||
            !value ||
            Object.keys(value).some((k) => !['format', 'order'].includes(k)) ||
            !['values', 'labelled', 'json', 'tsv'].includes(value.format) ||
            !Array.isArray(value.order) ||
            value.order.length > 100 ||
            value.order.some((k) => typeof k !== 'string' || k.length > 200)
          )
            throw Error('INVALID_SETTINGS');
        }
        store.set('copy:preferences', preferences);
        return preferences;
      },
      importCopy: async (id) => {
        const { serializeCopy } = require('../shared/copy-format.mjs');
        const { copySource } = require('../shared/copy-sources.mjs');
        const payload = await serializeCopy(
          {
            sourceIds: ['import-source'],
            scope: 'value',
            selection: ['source'],
            orderedFields: ['text'],
            format: 'text'
          },
          {
            resolveSource: async () =>
              copySource('import-source', { text: classification.sourceText(id) }),
            revealedFields: ['text']
          }
        );
        return copyText(payload.text, clipboard);
      },
      classificationConfirm: (arg) =>
        classification.confirmClassification(arg.operationId, arg.decision),
      generate: (request) => generateProfile(request, { store }),
      poolStats: (request) => getPoolStats(request, { store }),
      poolChoose: async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'Data package', extensions: ['json', 'zip'] }]
        });
        return result.canceled ? { status: 'cancelled' } : poolCatalog.preview(result.filePaths[0]);
      },
      poolApply: (token) => poolCatalog.apply(token),
      poolCancel: (token) => poolCatalog.cancel(token),
      poolBundled: (country) => poolCatalog.useBundled(country),
      poolSelect: ({ country, key }) => poolCatalog.select(country, key),
      lastCard: () => store.get('lastCard') || null,
      clearCard: () => clearCard(store),
      settingsUpdate: (patch) => {
        if (Object.hasOwn(patch || {}, 'archiveRoot')) throw Error('USE_DIRECTORY_DIALOG');
        const next = { ...getSettings(store), ...patch };
        for (const c of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'])
          for (const t of ['model', 'tech', 'crypto'])
            resolvePreset(c, t, next, loadDataset(store, c));
        const updated = updateSettings(store, patch);
        if (!updated.proxyEnabled) proxyController?.abort();
        if (!updated.facebookEnabled) facebook.cancel();
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
  const measured = screen.getPrimaryDisplay().workAreaSize;
  // Headless Electron exposes a 1×1 virtual display; real work areas stay authoritative.
  const area = measured.width > 1 && measured.height > 1 ? measured : { width: 1280, height: 900 };
  const width = Math.min(1380, area.width, Math.max(360, area.width - 48));
  const height = Math.min(900, area.height, Math.max(360, area.height - 48));
  const window = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(360, area.width),
    minHeight: Math.min(360, area.height),
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
  app.on('before-quit', (event) => {
    if (imageExportPromise) {
      event.preventDefault();
      images.cancelExport();
      imageExportPromise.finally(() => app.quit()).catch(() => {});
      return;
    }
    if (serverInstance) serverInstance.close();
    proxyController?.abort();
    news?.close();
    facebook?.cancel();
    images?.cancelReads();
    geo?.close();
    classification.close();
    if (store) store.close();
  });
}
