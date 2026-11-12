import { mountCopyActions, initCopyPreferences, copyModelValue } from './utils/copy-actions.js';
import { readSettingsForm } from './ui/settings.js';
import { state } from './state.js';
import { $ } from './utils/dom.js';
import { toast } from './utils/toast.js';
import { copyText } from './utils/clipboard.js';
import { appHTML } from './ui/shell.js';
import { viewHTML } from './ui/views.js';
import { renderModal } from './ui/modal.js';
import { startTour } from './ui/tour.js';
import { newsBlockHTML } from './ui/news.js';
import { readMetadataForm, readMetadataData, draftFromOperations } from './ui/photos.js';
import { makeDemo } from './services/generator.js';
import { importErrorMessage } from './services/importer.js';
import { loadNews } from './services/news.js';
import { NEWS_SOURCES, sourcesForTopic } from '../../shared/news-catalog.mjs';
import { getNetworkInfo, getIpInfo, getPing, getSpeed, checkProxy } from './services/network.js';
import { parseIds, checkProfiles } from './services/checker.js';

const shuffle = (list) => {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

function renderAll() {
  document.documentElement.lang = 'en';
  document.documentElement.dataset.theme = 'dark';
  const app = document.getElementById('app');
  app.innerHTML = appHTML();
  bindView();
  renderModal();
  ensureNews();
  maybeAutoNetwork();
  animateSpeedValue();
}

function renderView() {
  const container = document.getElementById('view');
  if (!container) {
    renderAll();
    return;
  }
  container.innerHTML = viewHTML();
  bindView();
  ensureNews();
  maybeAutoNetwork();
  animateSpeedValue();
}

function animateSpeedValue() {
  const value = document.getElementById('speed-value');
  if (!value) return;
  const target = Number(value.dataset.value);
  if (!Number.isFinite(target) || target <= 0) return;
  const started = performance.now();
  const duration = 1400;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - progress) ** 4;
    value.textContent = (target * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(tick);
    else value.textContent = target.toFixed(1);
  };
  requestAnimationFrame(tick);
}

async function refreshPoolStats() {
  const country = state.locale,
    type = state.type;
  const stats = await window.blego.getPoolStats({ country, type });
  if (state.locale === country && state.type === type) state.poolStats = stats;
}
function imageDraftKey() {
  return state.imageEditTarget === 'group'
    ? 'group:' + (state.imageGroupId || 'ungrouped')
    : 'files:' +
        state.photos
          .filter((p) => p.selected)
          .map((p) => p.fileId)
          .sort()
          .join(',');
}
function stashImageDraft() {
  if (state.imageDraftKey) {
    state.imageDrafts ||= {};
    if (!state.metadataDraftDirty) {
      delete state.imageDrafts[state.imageDraftKey];
      return;
    }
    state.imageDrafts[state.imageDraftKey] = {
      draft: state.metadataDraft,
      origins: state.metadataOrigins,
      touched: state.metadataTouched || []
    };
  }
}
function restoreImageDraft() {
  state.imageDraftKey = imageDraftKey();
  const saved = state.imageDrafts?.[state.imageDraftKey];
  const ops =
    state.imageEditTarget === 'group'
      ? state.imageWorkspace?.groups.find((g) => g.id === (state.imageGroupId || 'ungrouped'))
          ?.operations
      : state.photos.filter((p) => p.selected).length === 1
        ? state.imageWorkspace?.overrides[state.photos.find((p) => p.selected).fileId]
        : [];
  const loaded = saved || draftFromOperations(ops || []);
  state.metadataDraftDirty = !!saved;
  state.metadataDraft = loaded.draft;
  state.metadataOrigins = loaded.origins || {};
  state.metadataTouched = loaded.touched || [];
}
async function workspaceChange(action, request = {}) {
  const reply = await window.blego.changeImageWorkspace({ action, ...request });
  state.imageWorkspace = reply.workspace;
  state.metadataPlan = null;
  return reply.result;
}
async function applyImageForm() {
  const ops = readMetadataForm(document.getElementById('metadata-form'));
  if (state.imageEditTarget === 'group')
    await workspaceChange('setGroupOperations', {
      groupId: state.imageGroupId || 'ungrouped',
      operations: ops
    });
  else {
    const selected = state.photos.filter((p) => p.selected);
    for (const photo of selected) {
      const updates =
        selected.length > 1
          ? ops.filter((op) => (state.metadataTouched || []).includes(op.field))
          : ops;
      if (!updates.length) continue;
      const overrides =
        selected.length > 1
          ? [
              ...(state.imageWorkspace.overrides[photo.fileId] || []).filter(
                (op) => !updates.some((update) => update.field === op.field)
              ),
              ...updates
            ]
          : updates;
      await workspaceChange('setFileOverrides', { fileId: photo.fileId, overrides });
    }
  }
  if (state.imageDrafts) delete state.imageDrafts[state.imageDraftKey];
  restoreImageDraft();
}
async function prepareImageExport(retry = {}) {
  await state.imageInvalidation;
  const fileIds = state.photos.filter((p) => p.selected).map((p) => p.fileId);
  await workspaceChange('select', { fileIds });
  const scope = document.getElementById('image-export-scope')?.value || 'selection';
  const groupId = state.imageGroupId || 'ungrouped';
  const workspace = state.imageWorkspace;
  const ids =
    scope === 'selection'
      ? fileIds
      : scope === 'group'
        ? Object.keys(workspace.membership).filter((id) => workspace.membership[id] === groupId)
        : Object.keys(workspace.membership);
  const destinationByGroup = {};
  for (const id of new Set(ids.map((id) => workspace.membership[id]))) {
    toast('Choose export folder for ' + workspace.groups.find((g) => g.id === id).name);
    const token = await window.blego.chooseImageDestination();
    if (!token) return;
    destinationByGroup[id] = token;
  }
  state.metadataPlan = await window.blego.prepareGroupExport({
    scope,
    groupId,
    workspaceRevision: workspace.revision,
    destinationByGroup,
    ...retry,
    acknowledgeMakerNotes: !!document.querySelector('[name="confirm-maker"]')?.checked
  });
}
function bindView() {
  mountCopyActions();
  for (const [id, key] of [
    ['image-group-panel', 'photoGroupsOpen'],
    ['photo-preset-panel', 'photoPresetsOpen'],
    ['photo-advanced-panel', 'photoAdvancedOpen']
  ]) {
    const details = document.getElementById(id);
    if (details) details.ontoggle = () => { state[key] = details.open; };
  }
  const newsTopic = document.getElementById('news-topic');
  if (newsTopic) newsTopic.onchange = async (event) => {
    state.news.topic = event.target.value;
    await window.blego.updateSettings({ newsTopic: state.news.topic });
    updateNews(true);
    await refreshNews(true);
  };
  document.querySelectorAll('[data-image-select]').forEach((input) => {
    input.onchange = () => {
      const photo = state.photos.find((p) => p.fileId === input.dataset.imageSelect);
      photo.selected = input.checked;
      state.imageInvalidation = workspaceChange('select', {
        fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId)
      }).catch((e) => toast(e.message, 'err'));
      state.metadataPlan = null;
      stashImageDraft();
      restoreImageDraft();
      renderView();
    };
  });
  for (const [id, key] of [
    ['image-group', 'imageGroupId'],
    ['image-edit-target', 'imageEditTarget']
  ]) {
    const input = document.getElementById(id);
    if (input)
      input.onchange = () => {
        stashImageDraft();
        state[key] = input.value;
        state.imageInvalidation = workspaceChange('select', {
          fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId)
        }).catch((e) => toast(e.message, 'err'));
        restoreImageDraft();
        state.metadataPlan = null;
        renderView();
      };
  }
  const metadataForm = document.getElementById('metadata-form');
  if (metadataForm) {
    for (const [key, value] of Object.entries(state.metadataDraft || {})) {
      const control = metadataForm.elements.namedItem(key);
      if (control) {
        if (control.type === 'checkbox') control.checked = value;
        else control.value = value;
      }
    }
    metadataForm.oninput = (event) => {
      const name = event.target.name || '';
      const field = name.startsWith('action-')
        ? name.slice(7)
        : name.startsWith('value-')
          ? name.slice(6)
          : name.startsWith('gps-')
            ? 'gps'
            : name.startsWith('date-')
              ? 'captureDate'
              : null;
      if (field) {
        state.metadataDraftDirty = true;
        state.metadataTouched = [...new Set([...(state.metadataTouched || []), field])];
      }
      if (event.target.name?.startsWith('value-'))
        delete state.metadataOrigins?.[event.target.name.slice(6)];
      if (event.target.name?.startsWith('gps-')) delete state.metadataOrigins?.gps;
      if (event.target.name?.startsWith('date-')) delete state.metadataOrigins?.captureDate;
      state.metadataDraft = Object.fromEntries(new FormData(metadataForm));
      state.metadataDraft['confirm-maker'] =
        metadataForm.elements.namedItem('confirm-maker').checked;
      state.metadataPlan = null;
      state.imageInvalidation = workspaceChange('select', {
        fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId)
      }).catch((e) => toast(e.message, 'err'));
      document.querySelector('[data-metadata-plan]')?.remove();
    };
    metadataForm.onsubmit = async (event) => {
      event.preventDefault();
      try {
        await applyImageForm();
        await prepareImageExport();
        renderView();
      } catch (error) {
        toast(error.message, 'err');
      }
    };
  }
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm)
    settingsForm.onsubmit = async (event) => {
      event.preventDefault();
      try {
        state.settings = await window.blego.updateSettings(readSettingsForm(settingsForm));
        state.locale = state.settings.country;
        state.type = state.settings.type;
        await refreshPoolStats();
        toast('Settings saved');
        renderView();
      } catch (e) {
        toast(`Settings were not saved: ${e.message}`, 'err');
      }
    };

  document.querySelectorAll('[data-input="locale"]').forEach((select) => {
    select.onchange = async (event) => {
      state.locale = event.target.value;
      state.settings = await window.blego.updateSettings({ country: state.locale });
      await refreshPoolStats();
      renderView();
    };
  });
  document.querySelectorAll('[data-input="type"]').forEach((select) => {
    select.onchange = async (event) => {
      state.type = event.target.value;
      state.settings = await window.blego.updateSettings({ type: state.type });
      await refreshPoolStats();
      renderView();
    };
  });
  const archiveFilter = document.getElementById('archive-filter');
  if (archiveFilter)
    archiveFilter.onsubmit = async (event) => {
      event.preventDefault();
      const d = new FormData(archiveFilter);
      state.archiveQuery = Object.fromEntries(d);
      try {
        state.archives = await window.blego.listArchives(state.archiveQuery);
        renderView();
      } catch (e) {
        toast(e.message, 'err');
      }
    };
  const proxy = document.getElementById('proxy-input');
  if (proxy) {
    proxy.oninput = (event) => {
      state.network.proxyInput = event.target.value;
    };
  }
  const checker = document.getElementById('checker-input');
  if (checker) {
    checker.oninput = (event) => {
      state.checker.input = event.target.value;
      const count = event.target.value.trim()
        ? event.target.value
            .trim()
            .split(/\r?\n/)
            .filter((line) => line.trim()).length
        : 0;
      const label = document.getElementById('checker-count');
      if (label) label.textContent = `${count} rows`;
      const button = document.querySelector('[data-action="checker-run"]');
      if (button) button.disabled = !event.target.value.trim();
    };
  }
  const encoding = document.getElementById('import-encoding');
  if (encoding)
    encoding.onchange = (e) => {
      state.importEncoding = e.target.value;
    };
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.onchange = (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleFile(file);
      fileInput.value = '';
    };
  }
  const photoInput = document.getElementById('photo-input');
  if (photoInput) {
    photoInput.onchange = (event) => {
      if (event.target.files && event.target.files.length) addPhotos(event.target.files);
      photoInput.value = '';
    };
  }
  bindDrop('drop', handleFile);
  bindDrop('photo-drop', (file, files) => addPhotos(files || [file]));
}

function bindDrop(id, onFiles) {
  const zone = document.getElementById(id);
  if (!zone) return;
  ['dragenter', 'dragover'].forEach((name) =>
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((name) =>
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove('over');
    })
  );
  zone.addEventListener('drop', (event) => {
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (id === 'photo-drop') onFiles(files[0], files);
    else onFiles(files[0]);
  });
}

async function generate() {
  if (state.demoBusy) return;
  state.demoBusy = true;
  renderView();
  try {
    state.demo = await makeDemo(state.locale, state.type);
    toast('New set saved');
  } catch (e) {
    toast(
      e.message === 'POOL_EXHAUSTED'
        ? `Finite dictionary exhausted: ${e.details?.field || 'field'} (${e.details?.scope || 'local'}). Adjust optional repeats or extend the dictionary.`
        : e.message,
      'err'
    );
  } finally {
    state.demoBusy = false;
    try {
      await refreshPoolStats();
    } catch {
      state.poolStats = null;
    }
    renderView();
  }
}

async function handleFile(file) {
  if (state.importRequest || state.importData?.operationId)
    await window.blego.cancelImport(state.importRequest || state.importData.operationId);
  state.importName = file.name;
  state.importData = null;
  state.view = 'import';
  if (file.size > 50 * 1024 * 1024) {
    state.importStep = 'error';
    state.importError = 'File exceeds 50 MiB';
    renderAll();
    return;
  }
  const id = crypto.randomUUID();
  state.importRequest = id;
  state.importStep = 'loading';
  renderAll();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (state.importRequest !== id) return;
    const result = await window.blego.readInput({
      requestId: id,
      originalName: file.name,
      bytes,
      encoding: state.importEncoding || undefined
    });
    if (state.importRequest !== id) {
      await window.blego.cancelImport(result.operationId);
      return;
    }
    state.importData = await window.blego.importPage({
      operationId: result.operationId,
      offset: 0
    });
    state.importStep = 'preview';
  } catch (e) {
    if (state.importRequest === id) {
      state.importError = importErrorMessage(e.message);
      state.importStep = 'error';
    }
  } finally {
    if (state.importRequest === id) state.importRequest = null;
    renderView();
  }
}
function loadSample() {
  return handleFile(
    new File(
      ['project,owner,note\nExample,Sample,"Кириллица"\nExample,Sample,"Кириллица"'],
      'sample.csv',
      { type: 'text/csv' }
    )
  );
}
async function importPage(offset) {
  try {
    state.importData = await window.blego.importPage({
      operationId: state.importData.operationId,
      offset
    });
    renderView();
  } catch (e) {
    toast(e.message, 'err');
  }
}

function ensureNews() {
  // Never fetch in the background merely because the Generator is visible.
  if (state.view === 'news' && state.settings.newsEnabled &&
      !state.news.lastAttemptAt && !state.news.loading) refreshNews(false);
}

async function refreshNews(force) {
  if (state.news.loading) return;
  // Opening News or pressing Refresh is explicit permission for the listed foreign RSS sources.
  if (!state.settings.newsEnabled || !state.settings.newsSources?.length) {
    try {
      state.settings = await window.blego.updateSettings({ newsEnabled: true, newsSources: NEWS_SOURCES });
    } catch (error) {
      toast('Не удалось открыть ленту: ' + error.message, 'err');
      return;
    }
  }
  state.news.loading = true;
  state.news.error = '';
  updateNews();
  try {
    const data = await loadNews(force, sourcesForTopic(state.news.topic || 'fashion'));
    state.news.items = data.items;
    state.news.counts = data.counts || {};
    state.news.updatedAt = data.lastSuccessfulAt ? Date.parse(data.lastSuccessfulAt) : 0;
    state.news.sourceStates = data.sourceStates;
    state.news.lastAttemptAt = data.lastAttemptAt;

    state.news.error =
      data.error ||
      (data.items.length
        ? ''
        : 'News sources did not respond. Check the connection and try again.');
  } catch (error) {
    void error;
    state.news.error = 'News is unavailable. Check the connection and try again.';
  }
  state.news.loading = false;
  updateNews(true);
}

function updateNews(force = false) {
  const block = document.getElementById('news-block');
  if (block) {
    const selection = window.getSelection();
    if (
      !force && (block.contains(document.activeElement) ||
      (selection?.toString() && block.contains(selection.anchorNode)))
    )
      return;
    const content = document.getElementById('view');
    const top = content?.scrollTop;
    block.outerHTML = newsBlockHTML();
    if (content) content.scrollTop = top;
  }
}

function maybeAutoNetwork() {}

async function runNetwork(full) {
  if (!state.settings.proxyEnabled || state.network.running) return;
  state.network.running = true;
  state.network.stage = 'Pinging';
  state.network.error = '';
  renderView();
  const [infoResult, ipResult, pingResult] = await Promise.allSettled([
    getNetworkInfo(),
    getIpInfo(),
    getPing()
  ]);
  state.network.info = infoResult.status === 'fulfilled' ? infoResult.value : null;
  state.network.ip = ipResult.status === 'fulfilled' ? ipResult.value : null;
  state.network.ping = pingResult.status === 'fulfilled' ? pingResult.value : null;
  if (!state.network.ip)
    state.network.error = 'IP lookup failed. Check the connection and run the test again.';
  state.network.stage = full ? 'Measuring throughput' : '';
  renderView();
  if (full) {
    const speedResult = await Promise.allSettled([getSpeed()]);
    if (speedResult[0].status === 'fulfilled') {
      state.network.speed = speedResult[0].value;
    } else {
      state.network.error = 'Speed test failed. Try again in a moment.';
    }
  }
  state.network.running = false;
  state.network.stage = '';
  renderView();
}

async function runProxyCheck() {
  if (!state.settings.proxyEnabled || state.network.proxyLoading) return;
  state.network.proxyLoading = true;
  state.network.proxyError = '';
  renderView();
  try {
    state.network.proxy = await checkProxy(state.network.proxyInput.trim());
  } catch (error) {
    state.network.proxy = null;
    state.network.proxyError = `Proxy check failed: ${error.message}`;
  }
  state.network.proxyLoading = false;
  renderView();
}

async function addPhotos() {
  if (state.imagesBusy) return;
  stashImageDraft();
  state.imagesBusy = true;
  state.imagesReading = true;
  state.imagesReadCancelled = false;
  renderView();
  try {
    const files = await window.blego.chooseImages();
    state.photos.push(...files);
    state.metadataPresets = await window.blego.metadataPresets();
    state.imageWorkspace = await window.blego.imageWorkspace();
    for (const file of files) {
      if (state.imagesReadCancelled) {
        file.status = 'cancelled';
        continue;
      }
      file.status = 'reading';
      renderView();
      try {
        file.view = await window.blego.readImageMetadata(file.fileId);
        file.size = file.view.size;
        file.status = 'ready';
        file.selected = file.view.capabilities.writable;
      } catch (error) {
        file.status = error.message === 'CANCELLED' ? 'cancelled' : 'failed';
        file.error = error.message;
      }
    }
    state.metadataPlan = null;
  } catch (error) {
    toast(error.message, 'err');
  } finally {
    state.imagesBusy = false;
    state.imagesReading = false;
    restoreImageDraft();
    renderView();
  }
}
async function removePhoto(id) {
  stashImageDraft();
  try {
    await window.blego.removeImage(id);
    state.imageWorkspace = await window.blego.imageWorkspace();
    state.photos = state.photos.filter((photo) => photo.fileId !== id);
    restoreImageDraft();
    state.metadataPlan = null;
    state.imagePreview = null;
    renderView();
  } catch (error) {
    toast(error.message, 'err');
  }
}
async function clearPhotos() {
  stashImageDraft();
  try {
    await window.blego.clearImages();
    state.photos = [];
    state.imageReference = null;
    state.metadataExport = null;
    state.metadataProgress = {};
    state.imageDrafts = Object.fromEntries(
      Object.entries(state.imageDrafts || {}).filter(([key]) => key.startsWith('group:'))
    );
    state.imageWorkspace = await window.blego.imageWorkspace();
    restoreImageDraft();
    state.metadataPlan = null;
    state.imagePreview = null;
    renderView();
  } catch (error) {
    toast(error.message, 'err');
  }
}
document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'archive-page') {
    state.archiveQuery = { ...state.archiveQuery, offset: Number(target.dataset.offset) };
    window.blego
      .listArchives(state.archiveQuery)
      .then((v) => {
        state.archives = v;
        renderView();
      })
      .catch((e) => toast(e.message, 'err'));
    return;
  }
  if (action === 'archive-open') {
    window.blego
      .openArchive(target.dataset.id)
      .then((v) => {
        state.archiveView = v;
        renderView();
      })
      .catch((e) => toast(e.message, 'err'));
    return;
  }
  if (action === 'archive-export') {
    window.blego
      .exportArchive({ id: target.dataset.id, text: target.dataset.kind === 'txt' })
      .then((r) => {
        if (r.ok) toast('Exported');
      })
      .catch((e) => toast(e.message, 'err'));
    return;
  }
  if (action === 'archive-delete') {
    window.blego
      .removeArchive(target.dataset.id)
      .then(async (ok) => {
        if (ok) {
          state.archiveView = null;
          state.archives = await window.blego.listArchives();
          renderView();
        }
      })
      .catch((e) => toast(e.message, 'err'));
    return;
  }
  if (action === 'archive-folder') {
    window.blego.archiveFolder(target.dataset.id);
    return;
  }
  if (action === 'archive-back') {
    state.archiveView = null;
    renderView();
    return;
  }
  if (action === 'set-view') {
    state.view = target.dataset.view;
    if (state.view === 'history')
      window.blego
        .listArchives()
        .then((v) => {
          state.archives = v;
          renderView();
        })
        .catch((e) => toast(e.message, 'err'));
    state.modal = null;
    renderAll();
    return;
  }
  if (action === 'archive-directory') {
    window.blego
      .chooseArchiveDirectory()
      .then((s) => {
        state.settings = s;
        renderView();
      })
      .catch(() => toast('Folder unchanged', 'err'));
    return;
  }
  if (action?.startsWith('pool-')) {
    try {
      if (action === 'pool-choose') {
        if (state.poolImport) await window.blego.cancelPoolPackage(state.poolImport.fileToken);
        state.poolImport = null;
        const preview = await window.blego.choosePoolPackage();
        if (preview.status === 'preview') state.poolImport = preview;
      } else if (action === 'pool-apply') {
        await window.blego.applyPoolPackage(state.poolImport.fileToken);
        state.poolImport = null;
      } else if (action === 'pool-cancel') {
        await window.blego.cancelPoolPackage(state.poolImport.fileToken);
        state.poolImport = null;
      } else if (action === 'pool-bundled') await window.blego.useBundledPool(state.locale);
      else if (action === 'pool-select')
        await window.blego.selectPoolVersion({
          country: state.locale,
          key: document.getElementById('pool-version').value
        });
      await refreshPoolStats();
      renderView();
    } catch (error) {
      toast(`Data package unchanged: ${error.message}`, 'err');
    }
    return;
  }
  if (action === 'generate') {
    generate();
    return;
  }
  if (action === 'clear-demo') {
    window.blego
      .clearCard()
      .then(() => {
        state.demo = null;
        renderView();
      })
      .catch(() => toast('Could not clear card', 'err'));
    renderView();
    toast('Set cleared');
    return;
  }
  if (action === 'copy-model') {
    try {
      await copyModelValue(
        target.dataset.source,
        target.dataset.row,
        target.dataset.field,
        target,
        { card: target.dataset.card === 'true', personal: target.dataset.personal === 'true' }
      );
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'copy') {
    copyText(target.dataset.copy || '', target);
    return;
  }
  if (action === 'cell-expand') {
    const cell = target.closest('td');
    if (cell) cell.classList.toggle('expanded');
    return;
  }
  if (action === 'import-sample') {
    loadSample();
    return;
  }
  if (action === 'import-page') {
    importPage(Number(target.dataset.offset));
    return;
  }
  if (action === 'import-copy') {
    window.blego
      .copySource(state.importData.operationId)
      .then((r) => toast(r.ok ? 'Copied' : 'Copy failed; select text manually', r.ok ? '' : 'err'));
    return;
  }
  if (action === 'import-reset') {
    const id = state.importRequest || state.importData?.operationId;
    if (id) window.blego.cancelImport(id);
    state.importRequest = null;
    state.importStep = 'idle';
    state.importData = null;
    state.importName = '';
    state.importError = '';
    state.importSaved = null;
    renderView();
    return;
  }

  if (action === 'open-entry') {
    state.modal = { type: 'entry', id: target.dataset.id };
    renderModal();
    return;
  }
  if (action === 'ask-delete') {
    state.modal = { type: 'delete', id: target.dataset.id };
    renderModal();
    return;
  }
  if (action === 'delete-entry') {
    state.history = state.history.filter((entry) => entry.id !== target.dataset.id);
    state.modal = null;
    renderAll();
    toast('Entry deleted');
    return;
  }
  if (action === 'close-modal') {
    state.modal = null;
    renderModal();
    return;
  }
  if (action === 'overlay') {
    if (event.target === target) {
      state.modal = null;
      renderModal();
    }
    return;
  }
  if (action === 'news-cancel') {
    window.blego.cancelNews();
    return;
  }
  if (action === 'news-refresh') {
    refreshNews(true);
    return;
  }
  if (action === 'net-run' || action === 'net-ping') {
    try {
      if (!state.settings.proxyEnabled)
        state.settings = await window.blego.updateSettings({ proxyEnabled: true });
      await runNetwork(action === 'net-run');
    } catch (error) {
      toast('Не удалось выполнить проверку сети', 'err');
    }
    return;
  }
  if (action === 'proxy-cancel') {
    window.blego.cancelProxy();
    return;
  }
  if (action === 'proxy-check') {
    try {
      if (!state.settings.proxyEnabled)
        state.settings = await window.blego.updateSettings({ proxyEnabled: true });
      await runProxyCheck();
    } catch {
      toast('Не удалось начать проверку прокси', 'err');
    }
    return;
  }
  if (
    action.startsWith('group-') ||
    action.startsWith('reference-') ||
    action.startsWith('preset-')
  ) {
    try {
      const groupId = state.imageGroupId || 'ungrouped',
        fileIds = state.photos.filter((p) => p.selected).map((p) => p.fileId);
      if (action === 'group-create') {
        const g = await workspaceChange('createGroup', {
          name: document.getElementById('image-group-name').value
        });
        stashImageDraft();
        state.imageGroupId = g.id;
        restoreImageDraft();
      }
      if (action === 'group-rename')
        await workspaceChange('renameGroup', {
          groupId,
          name: document.getElementById('image-group-name').value
        });
      if (
        action === 'group-delete' &&
        confirm('Delete group and move its files to Без группы? Original files stay unchanged.')
      ) {
        await workspaceChange('removeGroup', { groupId, moveTo: 'ungrouped', confirmed: true });
        state.imageGroupId = 'ungrouped';
        restoreImageDraft();
      }
      if (action === 'group-move')
        await workspaceChange('moveFiles', { fileIds, targetGroupId: groupId });
      if (action === 'group-select') {
        stashImageDraft();
        for (const p of state.photos)
          p.selected =
            !!p.view?.capabilities.writable &&
            state.imageWorkspace.membership[p.fileId] === groupId;
        await workspaceChange('select', {
          fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId)
        });
        restoreImageDraft();
      }
      if (action === 'group-save') {
        stashImageDraft();
        const updates = [];
        const { validateWorkspaceOperations } = await import('../../shared/image-workspace.mjs');
        for (const group of state.imageWorkspace.groups) {
          const cached = state.imageDrafts?.['group:' + group.id];
          if (cached?.draft)
            updates.push({
              groupId: group.id,
              operations: validateWorkspaceOperations(
                readMetadataData(new Map(Object.entries(cached.draft)), cached.origins)
              )
            });
        }
        for (const update of updates) await workspaceChange('setGroupOperations', update);
        await workspaceChange('save');
        for (const update of updates) delete state.imageDrafts['group:' + update.groupId];
        if (state.imageEditTarget === 'group') restoreImageDraft();
        toast('Group rules saved locally. File overrides remain session-only.');
      }
      if (action === 'group-operations') {
        await applyImageForm();
        toast('Rules applied in this session.');
      }
      if (action === 'reference-choose')
        state.imageReference = await window.blego.chooseImageReference();
      if (action === 'reference-use') {
        const fields = [...document.querySelectorAll('[data-reference-field]:checked')].map(
          (x) => x.dataset.referenceField
        );
        const ops = await window.blego.imageReferenceOperations({
          referenceId: state.imageReference.referenceId,
          fields
        });
        const loaded = draftFromOperations(ops);
        state.metadataDraft = { ...state.metadataDraft, ...loaded.draft };
        state.metadataOrigins = { ...state.metadataOrigins, ...loaded.origins };
        state.metadataDraftDirty = true;
        state.metadataTouched = [
          ...new Set([...(state.metadataTouched || []), ...ops.map((op) => op.field)])
        ];
        state.metadataPlan = null;
        stashImageDraft();
      }
      if (action.startsWith('preset-')) {
        const command = action.slice(7);
        if (command === 'delete' && !confirm('Delete this local preset?')) return;
        await window.blego.manageMetadataPreset({
          action: command,
          id: document.getElementById('metadata-preset').value,
          name: document.getElementById('metadata-preset-name').value,
          confirmed: command === 'delete'
        });
        state.metadataPresets = await window.blego.metadataPresets();
        state.metadataPlan = null;
      }
      renderView();
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'metadata-retry') {
    try {
      const fileIds = [...document.querySelectorAll('[data-retry-file]:checked')].map(
        (x) => x.dataset.retryFile
      );
      await prepareImageExport({ retryRunId: state.metadataExport.runId, fileIds });
      renderView();
    } catch (e) {
      toast(e.message, 'err');
    }
    return;
  }
  if (action === 'metadata-cancel-group') {
    await window.blego.cancelGroupExport({ runId: state.imageRunId, groupId: target.dataset.id });
    return;
  }
  if (action === 'metadata-cancel') {
    if (state.imagesReading) state.imagesReadCancelled = true;
    if (state.imagesReading) await window.blego.cancelImageExport();
    else await window.blego.cancelGroupExport({ runId: state.imageRunId });
    return;
  }
  if (action === 'metadata-report') {
    try {
      await window.blego.exportMetadataReport(target.dataset.format);
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'metadata-export') {
    if (state.imagesBusy || !state.metadataPlan) return;
    let unsubscribe;
    try {
      const plan = state.metadataPlan;
      const runId = crypto.randomUUID();
      state.imageRunId = runId;
      state.imagesBusy = true;
      state.metadataExport = null;
      state.metadataProgress = {};
      renderView();
      unsubscribe = window.blego.onImageProgress((result) => {
        if (result.runId && result.runId !== state.imageRunId) return;
        state.metadataProgress[result.fileId] = result;
        if (state.view === 'photos') {
          const box = document.querySelector('[data-metadata-progress]');
          if (box) {
            let row = box.querySelector(`[data-progress-id="${result.fileId}"]`);
            if (!row) {
              row = document.createElement('p');
              row.dataset.progressId = result.fileId;
              box.append(row);
            }
            row.textContent = [
              result.groupName,
              result.name,
              result.status,
              result.error,
              result.outputName
            ]
              .filter(Boolean)
              .join(' · ');
          }
        }
      });
      state.metadataExport = await window.blego.applyMetadataPlan({
        planId: plan.planId,
        workspaceRevision: plan.workspaceRevision,
        runId
      });
      state.imageExportHistory = await window.blego.imageExportHistory();
      state.metadataPlan = null;
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      unsubscribe?.();
      state.imagesBusy = false;
      renderView();
    }
    return;
  }
  if (action === 'images-choose') {
    await addPhotos();
    return;
  }
  if (action === 'image-copy') {
    try {
      const result = await window.blego.copyImage(target.dataset.id);
      if (!result.ok) throw Error(result.code);
      toast('Image pixels copied; metadata is not transferred.');
    } catch {
      toast('Image copy failed.', 'err');
    }
    return;
  }
  if (action === 'image-preview') {
    try {
      state.imagePreview = await window.blego.previewImage(target.dataset.id);
      renderView();
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'metadata-preset-plan') {
    try {
      const preset = state.metadataPresets.find(
        (p) => p.id === document.getElementById('metadata-preset').value
      );
      const loaded = draftFromOperations(
        preset.operations.map((op) => ({
          ...op,
          ...(op.action === 'set'
            ? {
                origin: {
                  kind: 'preset',
                  id: preset.id,
                  name: preset.name,
                  version: preset.schemaVersion
                }
              }
            : {})
        }))
      );
      state.metadataDraft = loaded.draft;
      state.metadataOrigins = loaded.origins;
      state.metadataDraftDirty = true;
      state.metadataTouched = preset.operations.map((op) => op.field);
      stashImageDraft();
      renderView();
      await applyImageForm();
      await prepareImageExport();
      renderView();
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'metadata-preset-save' || action === 'metadata-preset-import') {
    try {
      if (action === 'metadata-preset-save')
        await window.blego.saveMetadataPreset({
          schemaVersion: 1,
          name: document.getElementById('metadata-preset-name').value,
          operations: readMetadataForm(document.getElementById('metadata-form'))
            .filter((op) => op.action !== 'inherit')
            .map(({ origin, ...op }) => op)
        });
      else await window.blego.importMetadataPreset();
      state.metadataPresets = await window.blego.metadataPresets();
      renderView();
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'photo-remove') {
    removePhoto(target.dataset.id);
    return;
  }
  if (action === 'photos-clear') {
    clearPhotos();
    return;
  }
  if (action === 'friends-geo') {
    state.friendsGeo = target.dataset.geo || '';
    renderView();
    return;
  }
  if (action === 'checker-run') {
    await window.blego.cancelFacebook();
    const runId = crypto.randomUUID();
    state.checker.runId = runId;
    try {
      const rows = await parseIds(state.checker.input);
      if (state.checker.runId !== runId) return;
      state.checker.rows = rows;
      state.checker.checking = null;
    } catch (error) {
      toast(error.message, 'err');
      return;
    }
    renderView();
    if (state.checker.rows?.some((row) => row.link)) {
      try {
        if (!state.settings.facebookEnabled)
          state.settings = await window.blego.updateSettings({ facebookEnabled: true });
        runCheckerStatus();
      } catch {
        toast('Не удалось выполнить проверку', 'err');
      }
    }
    return;
  }
  if (action === 'checker-status') {
    runCheckerStatus();
    return;
  }
  if (action === 'checker-cancel') {
    await window.blego.cancelFacebook();
    return;
  }
  if (action === 'facebook-open') {
    await window.blego.openFacebook(target.dataset.target);
    return;
  }
  if (action === 'facebook-note') {
    const index = Number(target.dataset.index),
      row = state.checker.rows[index];
    try {
      const note = await window.blego.saveFacebookNote({
        targetKey: row.link,
        status: document.getElementById(`fb-note-status-${index}`).value,
        comment: document.getElementById(`fb-note-comment-${index}`).value
      });
      for (const item of state.checker.rows)
        if (item.link === row.link) item.notes = [...(item.notes || []), note];
      renderView();
    } catch (error) {
      toast(error.message, 'err');
    }
    return;
  }
  if (action === 'checker-clear') {
    await window.blego.cancelFacebook();
    state.checker = { input: '', rows: null };
    renderView();
  }
});

async function runCheckerStatus() {
  const rows = state.checker.rows;
  if (!rows || state.checker.checking) return;
  const targets = rows.filter((row) => row.link);
  const runId = crypto.randomUUID();
  state.checker.runId = runId;
  state.checker.checking = { done: 0, total: new Set(targets.map((row) => row.link)).size };
  renderView();
  try {
    const result = await checkProfiles(targets, runId, (done, total) => {
      if (state.checker.runId !== runId) return;
      state.checker.checking = { done, total };
      const label = document.getElementById('checker-progress-text');
      if (label) label.textContent = `Checking ${done} of ${total}`;
      const fill = document.getElementById('checker-progress-fill');
      if (fill) fill.style.width = `${(100 * done) / total}%`;
    });
    if (state.checker.runId !== runId) return;
    for (const row of state.checker.rows || [])
      row.check = result.results.find((value) => value.canonicalUrl === row.link);
  } catch (error) {
    if (state.checker.runId === runId) toast(error.message, 'err');
  } finally {
    if (state.checker.runId === runId) {
      state.checker.checking = null;
      renderView();
    }
  }
}

if (window.blego) {
  try {
    state.settings = await window.blego.getSettings();
    state.imageWorkspace = await window.blego.imageWorkspace();
    state.metadataPresets = await window.blego.metadataPresets();
    await initCopyPreferences();
    state.locale = state.settings.country;
    state.type = state.settings.type;
    await refreshPoolStats();
    state.demo = await window.blego.lastCard();
    state.news.topic = state.settings.newsTopic;
    const cached = await window.blego.newsSnapshot();
    Object.assign(state.news, cached);
    window.blego.onNews((data) => {
      Object.assign(state.news, data);
      state.news.updatedAt = data.lastSuccessfulAt ? Date.parse(data.lastSuccessfulAt) : 0;
      updateNews();
    });
  } catch {
    toast('Settings unavailable', 'err');
  }
}
renderAll();
setTimeout(() => {
  startTour({
    navigate: (view) => {
      state.view = view;
      renderView();
    }
  });
}, 700);
