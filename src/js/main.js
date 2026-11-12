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
import { networkError } from './ui/network.js';
import { readMetadataForm, readMetadataData, draftFromOperations, imageErrorMessage } from './ui/photos.js';
import { makeDemo } from './services/generator.js';
import { importErrorMessage } from './services/importer.js';
import { loadNews } from './services/news.js';
import { newsTopic } from '../../shared/news-catalog.mjs';
import { getNetworkInfo, getIpInfo, getPing, getSpeed, checkProxy } from './services/network.js';
import { parseIds, checkProfiles } from './services/checker.js';

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
function syncQuickMetadata() {
 const form=document.getElementById('metadata-form');if(!form)return;
 for(const field of ['captureDate','gps']){const wrap=form.querySelector(`[data-field-inputs="${field}"]`);if(wrap)wrap.hidden=form.elements.namedItem('action-'+field)?.value!=='set';}
 const offset=form.querySelector('[data-offset-input]');if(offset)offset.hidden=form.elements.namedItem('date-offset-mode')?.value!=='set';
}
function bindView() {
  mountCopyActions();
  for(const id of ['metadata-advanced','image-groups-advanced','date-options']){const el=document.getElementById(id);if(el)el.ontoggle=()=>{state.imageDisclosures||={};state.imageDisclosures[id]=el.open;};}
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
    syncQuickMetadata();
    metadataForm.oninput = (event) => {
      syncQuickMetadata();
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
      for(const k of ['exif','xmp'])state.metadataDraft['date-scope-'+k]=metadataForm.elements.namedItem('date-scope-'+k).checked;
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
        toast(imageErrorMessage(error.message), 'err');
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
      state.network.inputRevision = (state.network.inputRevision || 0) + 1;
      const stale = document.querySelector('[data-proxy-stale]');
      if (stale) stale.hidden = false;
    };
  }
  const facebookDetails=document.getElementById('facebook-details');
  if(facebookDetails)facebookDetails.ontoggle=()=>{state.checker.notesOpen=facebookDetails.open;};
  const checker = document.getElementById('checker-input');
  if (checker) {
    checker.oninput = (event) => {
      state.checker.input = event.target.value;
      const stale=document.querySelector('[data-checker-stale]');
      if(stale)stale.hidden=state.checker.checkedInput===event.target.value;
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
  state.demoError='';
  renderView();
  try {
    state.demo = await makeDemo(state.locale, state.type);
    toast('New set saved');
  } catch (e) {
    state.demoError=e.message==='POOL_EXHAUSTED'?'No unused values remain. Choose another country or add a data package in Settings.':'Generation failed. Check your settings and try again.';
    toast(state.demoError,'err');
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

let newsRequest = 0;
function ensureNews() {
  if (state.view !== 'news') return;
  if (!state.news.lastAttemptAt && !state.news.loading) refreshNews(false);
}
async function refreshNews(force) {
  const topic=state.news.topic, request=++newsRequest;
  state.news.loading=true;state.news.error='';updateNews();
  try {
    if (!state.settings.newsEnabled) state.settings=await window.blego.updateSettings({newsEnabled:true});
    const data=await loadNews(force,topic);
    if(request!==newsRequest||state.news.topic!==topic)return;
    Object.assign(state.news,data);
    state.news.updatedAt=data.lastSuccessfulAt?Date.parse(data.lastSuccessfulAt):0;
    const failed=Object.values(data.sourceStates||{}).some(s=>s.stale);
    state.news.error=data.cancelled?'Update cancelled.':failed?(data.items.length?'Some sources are unavailable. Saved articles remain available.':'News sources did not respond. Try again later.'):'';
  } catch {
    if(request!==newsRequest)return;
    state.news.error='News is unavailable. Saved articles remain available.';
  }
  state.news.loading=false;updateNews();
}
document.addEventListener('change',async event=>{
  if(event.target.id!=='news-topic')return;
  const topic=newsTopic(event.target.value);newsRequest++;
  state.news.topic=topic;state.news.items=[];state.news.lastAttemptAt=null;state.news.loading=true;state.news.error='';updateNews();
  try {
    await window.blego.updateSettings({newsTopic:topic});
    const cached=await window.blego.newsSnapshot(topic);
    if(state.news.topic!==topic)return;
    Object.assign(state.news,cached);state.news.updatedAt=cached.lastSuccessfulAt?Date.parse(cached.lastSuccessfulAt):0;
    refreshNews(false);
  }catch {state.news.loading=false;state.news.error='Could not load this topic.';updateNews();}
});

function updateNews() {
  const block = document.getElementById('news-block');
  if (block) {
    const selection = window.getSelection();
    if (
      (selection?.toString() && block.contains(selection.anchorNode))
    )
      return;
    const content = document.getElementById('view');
    const top = content?.scrollTop;
    block.outerHTML = newsBlockHTML();
    if (content) content.scrollTop = top;
  }
}

function maybeAutoNetwork() {}

let networkController = null;
async function runNetwork(full) {
  if (state.network.running || state.network.proxyLoading) return;
  const controller = new AbortController();
  networkController = controller;
  const n = state.network;
  n.running = true;
  n.stage = full ? 'Measuring speed' : 'Measuring TCP latency';
  n.error = '';
  if (full) n.speed = null;
  else {
    n.ping = null;
    n.ip = null;
  }
  renderView();
  try {
    state.settings = await window.blego.updateSettings({ proxyEnabled: true });
    if (full) n.speed = await getSpeed(controller.signal);
    else {
      const [info, ip, ping] = await Promise.allSettled([
        getNetworkInfo(controller.signal),
        getIpInfo(),
        getPing(controller.signal)
      ]);
      controller.signal.throwIfAborted();
      n.info = info.status === 'fulfilled' ? info.value : null;
      n.ip = ip.status === 'fulfilled' ? ip.value : null;
      n.ping = ping.status === 'fulfilled' ? ping.value : null;
      if (!n.ping?.targets?.some((t) => Number.isFinite(t.ms)))
        n.error = 'No TCP latency results. Check your connection.';
      if (n.ip?.connection !== 'ok') n.error ||= 'External IP could not be checked.';
    }
    controller.signal.throwIfAborted();
  } catch {
    n.error = controller.signal.aborted ? 'Check cancelled.' : 'Connection test failed. Try again.';
  } finally {
    n.running = false;
    n.stage = '';
    if (networkController === controller) networkController = null;
    renderView();
  }
}

async function runProxyCheck() {
  if (state.network.proxyLoading || state.network.running) return;
  const revision = state.network.inputRevision || 0;
  state.network.proxyLoading = true;
  state.network.proxyError = '';
  renderView();
  try {
    state.settings = await window.blego.updateSettings({ proxyEnabled: true });
    state.network.proxy = await checkProxy(state.network.proxyInput.trim());
    state.network.checkedRevision = revision;
  } catch (error) {
    state.network.proxy = null;
    state.network.proxyError = networkError(error.message);
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
        try {file.thumbnail=await window.blego.previewImage(file.fileId,true);}catch {file.thumbnail=null;}
      } catch (error) {
        file.status = error.message === 'CANCELLED' ? 'cancelled' : 'failed';
        file.error = error.message;
      }
    }
    state.metadataPlan = null;
  } catch (error) {
    toast(imageErrorMessage(error.message), 'err');
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
    toast(imageErrorMessage(error.message), 'err');
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
    toast(imageErrorMessage(error.message), 'err');
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
          state.archives = await window.blego.listArchives(state.archiveQuery || {});
          renderView();
        }
      })
      .catch((e) => toast(e.message, 'err'));
    return;
  }
  if (action === 'archive-folder') {
    window.blego.archiveFolder(target.dataset.id).catch(()=>toast('Could not open the archive folder.', 'err'));
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
        .listArchives(state.archiveQuery || {})
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
  if (action === 'net-cancel') {
    networkController?.abort();
    await window.blego.cancelProxy();
    return;
  }
  if (action === 'net-run' || action === 'net-ping') {
    runNetwork(action === 'net-run').catch(() => toast('Connection test could not start.', 'err'));
    return;
  }
  if (action === 'proxy-cancel') {
    window.blego.cancelProxy();
    return;
  }
  if (action === 'proxy-check') {
    runProxyCheck().catch(() => toast('Proxy check could not start.', 'err'));
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
      toast(imageErrorMessage(e.message), 'err');
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
      toast(imageErrorMessage(error.message), 'err');
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
              result.error ? imageErrorMessage(result.error) : null,
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
      toast(imageErrorMessage(error.message), 'err');
    } finally {
      unsubscribe?.();
      state.imagesBusy = false;
      renderView();
    }
    return;
  }
  if (action === 'images-choose' || action === 'images-browse') {
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
  if(action==='metadata-copy-input'){await copyText(document.querySelector('#metadata-form')?.elements.namedItem(target.dataset.name)?.value||'',target);return;}
  if(action==='image-preview-close'){stashImageDraft();state.imagePreview=null;renderView();return;}
  if (action === 'image-preview') {
    try {
      state.imagePreview = await window.blego.previewImage(target.dataset.id);
      renderView();
    } catch (error) {
      toast(imageErrorMessage(error.message), 'err');
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
      toast(imageErrorMessage(error.message), 'err');
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
      toast(imageErrorMessage(error.message), 'err');
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
    if(state.checker.checking)return;
    const runId=crypto.randomUUID(),input=state.checker.input;
    state.checker.runId=runId;state.checker.rows=null;state.checker.cancelled=false;
    state.checker.checking={done:0,total:0};renderView();
    try {
      await window.blego.cancelFacebook();
      const rows=await parseIds(input);
      if(state.checker.runId!==runId)return;
      state.checker.rows=rows;state.checker.checkedInput=input;
      if(rows.some(row=>row.link)) {
        if(!state.settings.facebookEnabled)state.settings=await window.blego.updateSettings({facebookEnabled:true});
        if(state.checker.runId!==runId)return;
        state.checker.checking=null;await runCheckerStatus(runId);
      } else {state.checker.checking=null;renderView();}
    }catch {
      if(state.checker.runId!==runId)return;
      state.checker.checking=null;renderView();toast('Could not start this check. Use up to 100 profile IDs or direct links.','err');
    }
    return;
  }
  if (action === 'checker-cancel') {
    state.checker.runId=null;state.checker.checking=null;state.checker.cancelled=true;
    for(const row of state.checker.rows||[])if(row.link&&!row.check)row.check={availability:'cancelled',reasonCode:'CANCELLED'};
    renderView();await window.blego.cancelFacebook();return;
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
    state.checker = { input: '', rows: null };
    renderView();
    await window.blego.cancelFacebook();
  }
});

async function runCheckerStatus(runId = crypto.randomUUID()) {
  const rows = state.checker.rows;
  if (!rows || state.checker.checking) return;
  const targets = rows.filter((row) => row.link);
  state.checker.runId = runId;
  state.checker.checking = { done: 0, total: new Set(targets.map((row) => row.link)).size };
  renderView();
  try {
    const result = await checkProfiles(targets, runId, (done, total, result) => {
      if (state.checker.runId !== runId) return;
      for(const row of rows)if(row.link===result.canonicalUrl)row.check=result;
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
    if (state.checker.runId === runId) toast('Could not complete this check. Try again.', 'err');
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
    state.news.topic = newsTopic(state.settings.newsTopic);
    const cached = await window.blego.newsSnapshot(state.news.topic);
    Object.assign(state.news, cached);
    window.blego.onNews((data) => {
      if (data.topic !== state.news.topic) return;
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
