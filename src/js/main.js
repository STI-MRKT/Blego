import { mountCopyActions, initCopyPreferences, copyModelValue, invalidateImportCopies } from './utils/copy-actions.js';
import { readSettingsForm } from './ui/settings.js';
import { mountPhotoMap } from './ui/photo-map.js';
import { state } from './state.js';
import { $ } from './utils/dom.js';
import { toast } from './utils/toast.js';
import { copyText } from './utils/clipboard.js';
import { appHTML } from './ui/shell.js';
import { viewHTML } from './ui/views.js';
import { renderModal } from './ui/modal.js';
import { startTour } from './ui/tour.js';
let workspaceInteracted = false;
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => { workspaceInteracted = true; }, { once: true, capture: true });
import { newsBlockHTML } from './ui/news.js';
import { readMetadataForm, readMetadataData, draftFromOperations, imageErrorMessage } from './ui/photos.js';
import { makeDemo } from './services/generator.js';
import { importErrorMessage } from './services/importer.js';
import { loadNews } from './services/news.js';
import { newsTopic } from '../../shared/news-catalog.mjs';
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
let imagePreviewRequest=0;
function invalidateImagePreview(){imagePreviewRequest++;state.imagePreview=null;state.imagePreviewName='';}
async function workspaceChange(action, request = {}) {
  if(['select','moveFiles','removeGroup'].includes(action))invalidateImagePreview();
  const reply = await window.blego.changeImageWorkspace({ action, ...request });
  state.imageWorkspace = reply.workspace;
  state.metadataPlan = null;
  return reply.result;
}
async function applyImageForm({excludeGPS=false}={}) {
  let ops = readMetadataForm(document.getElementById('metadata-form'));
  if(excludeGPS)ops=ops.filter(o=>o.field!=='gps');
  if (state.imageEditTarget === 'group')
    await workspaceChange('setGroupOperations', {
      groupId: state.imageGroupId || 'ungrouped',
      operations: excludeGPS ? [...(state.imageWorkspace.groups.find(g=>g.id===(state.imageGroupId||'ungrouped'))?.operations||[]).filter(o=>o.field==='gps'),...ops] : ops
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
        selected.length > 1 || excludeGPS
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
 const altitude=form.elements.namedItem('gps-altitude');if(altitude)altitude.disabled=form.elements.namedItem('gps-altitude-mode')?.value!=='set';
 const offset=form.querySelector('[data-offset-input]');if(offset)offset.hidden=form.elements.namedItem('date-offset-mode')?.value!=='set';
}
function bindView() {
  mountCopyActions();
  mountPhotoMap({onMove:async(fileId,value)=>{
    if(state.imagesBusy)return;
    stashImageDraft();state.imagesBusy=true;
    try {
      const result=await window.blego.moveImageGeo({fileId,value,cityId:state.geoCity,workspaceRevision:state.imageWorkspace.revision,requestId:crypto.randomUUID()});
      state.imageWorkspace=result.workspace;state.metadataPlan=null;
    } finally {state.imagesBusy=false;restoreImageDraft();renderView();}
  },onError:error=>toast(imageErrorMessage(error.message),'err')});
  for(const id of ['metadata-advanced','image-groups-advanced','date-options','gps-manual']){const el=document.getElementById(id);if(el)el.ontoggle=()=>{state.imageDisclosures||={};state.imageDisclosures[id]=el.open;};}
  document.querySelectorAll('[data-image-select]').forEach((input) => {
    input.onchange = () => {
      const photo = state.photos.find((p) => p.fileId === input.dataset.imageSelect);
      photo.selected = input.checked;
      if(state.photoMap)state.photoMap.selected=photo.fileId;
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
  const geoCountry=document.getElementById('geo-country');
  const updateCities=()=>{const select=document.getElementById('geo-city');if(!select)return;select.replaceChildren(new Option('Выберите город',''),...(state.geoCatalogue?.cities||[]).filter(c=>c.country===state.geoCountry&&(!state.geoQuery||`${c.name} ${c.region}`.toLowerCase().includes(state.geoQuery.toLowerCase()))).map(c=>new Option(`${c.name} — ${c.region}`,c.id)));select.value=state.geoCity||'';document.querySelector('[data-action="geo-generate"]').disabled=!select.value;};
  if(geoCountry)geoCountry.onchange=()=>{const c=state.geoCatalogue.countries.find(c=>c.code===geoCountry.value.trim().toUpperCase()||c.name.toLowerCase()===geoCountry.value.trim().toLowerCase());state.geoCountry=c?.code||'';state.geoCity='';geoCountry.value=state.geoCountry;updateCities();mountPhotoMap();};
  const geoQuery=document.getElementById('geo-city-query');if(geoQuery)geoQuery.oninput=()=>{state.geoQuery=geoQuery.value;updateCities();};
  const geoCity=document.getElementById('geo-city');if(geoCity)geoCity.onchange=()=>{state.geoCity=geoCity.value;document.querySelector('[data-action="geo-generate"]').disabled=!state.geoCity;stashImageDraft();renderView();};
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
  const friendsSearch=document.getElementById('friends-search');
  if(friendsSearch){friendsSearch.onsubmit=event=>{event.preventDefault();state.friendsQuery=document.getElementById('friends-query').value;state.friendsPage=0;renderView();};document.getElementById('friends-query').oninput=event=>{state.friendsQuery=event.target.value;};}
  const friendsPlatform=document.getElementById('friends-platform');if(friendsPlatform)friendsPlatform.onchange=()=>{state.friendsPlatform=friendsPlatform.value;state.friendsPage=0;renderView();};
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
      state.network.proxy=null;state.network.proxyError='';
      document.querySelector('.proxy-result')?.remove();
      document.querySelector('.proxy-card .banner.err')?.remove();
    };
  }
  for(const [id,key] of [['checker-status-filter','statusFilter'],['checker-sort','sort']]){const el=document.getElementById(id);if(el)el.onchange=()=>{state.checker[key]=el.value;renderView();};}
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
      if (label) label.textContent = `${count} строк`;
      const button = document.querySelector('[data-action="checker-run"]');
      if (button) button.disabled = !event.target.value.trim();
    };
  }
  const encoding = document.getElementById('import-encoding');
  if (encoding)
    encoding.onchange = (e) => {
      state.importEncoding = e.target.value;
    };
  for (const [id,key] of [['classifier-schema','schema'],['classifier-headers','headers']]) {
    const el = document.getElementById(id);
    if (el) el.onchange = () => { state.classifierOptions ||= {}; state.classifierOptions[key] = el.value; };
  }
  document.querySelectorAll('[data-classifier-map]').forEach(el => {
    el.onchange = () => {state.classifierOptions ||= {}; state.classifierOptions.mapping ||= {}; if(el.value) state.classifierOptions.mapping[el.dataset.classifierMap]=el.value; else delete state.classifierOptions.mapping[el.dataset.classifierMap];};
  });
  document.querySelectorAll('[data-classifier-row-map]').forEach(el=>{el.onchange=()=>{state.classifierOptions ||= {}; const maps=state.classifierOptions.recordMapping ||= {}; const row=maps[el.dataset.row] ||= {}; if(el.value)row[el.dataset.column]=el.value;else delete row[el.dataset.column];};});
  const warningsOnly=document.getElementById('classifier-warnings-only');
  if(warningsOnly)warningsOnly.onchange=()=>{state.classifierWarningsOnly=warningsOnly.checked;state.classifierDetailRow=null;state.classifierRevealed={};importPage(0);};
  const extra = document.getElementById('classifier-extra');
  if(extra) extra.ontoggle = () => {if(extra.isConnected) state.classifierExtraOpen=extra.open;};
  const sort = document.getElementById('classifier-sort');
  if (sort) sort.onchange = () => {state.classifierDescending=sort.value==='descending'; importPage(0);};
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

function classificationOptions() {
  const o = state.classifierOptions || {};
  return {schema:o.schema || undefined, headers:o.headers === 'yes' ? true : o.headers === 'no' ? false : undefined, mapping:o.mapping || {}, recordMapping:o.recordMapping || {}, encoding:state.importEncoding || undefined};
}
async function handleFile(file) {
  invalidateImportCopies();
  const epoch = state.importEpoch = (state.importEpoch || 0) + 1;
  if (state.importRequest || state.importData?.operationId)
    await window.blego.cancelImport(state.importRequest || state.importData.operationId);
  if (state.importEpoch !== epoch) return;
  state.classifierQuery = ''; state.classifierDescending = false; state.importSaved = null;
  state.classifierDetailRow=null;state.classifierRevealed={};state.classifierWarningsOnly=false;
  if(state.classifierOptions)state.classifierOptions.recordMapping={};
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
      options: classificationOptions(),
      encoding: state.importEncoding || undefined
    });
    if (state.importRequest !== id) {
      await window.blego.cancelImport(result.operationId);
      return;
    }
    const data = await window.blego.importPage({operationId:result.operationId,offset:0});
    if (state.importEpoch !== epoch) { await window.blego.cancelImport(result.operationId); return; }
    state.importData = data;
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
      ['fullName,accountId,email,geo\nExample Person,0001,person@example.com,GB\nSecond Person,0002,second@example.com,US'],
      'sample.csv',
      { type: 'text/csv' }
    )
  );
}
async function importPage(offset) {
  const operationId = state.importData?.operationId, epoch = state.importEpoch;
  const request = state.importPageRequest = (state.importPageRequest || 0) + 1;
  try {
    const data = await window.blego.importPage({operationId,offset,options:{query:state.classifierQuery || '',sort:'rowNumber',descending:!!state.classifierDescending,warningsOnly:!!state.classifierWarningsOnly}});
    if (state.importData?.operationId !== operationId || state.importEpoch !== epoch || state.importPageRequest !== request) return;
    state.importData = data; renderView();
  } catch { if(state.importEpoch===epoch) toast('Не удалось открыть страницу', 'err'); }
}
async function reclassifyInput() {
  invalidateImportCopies();
  const operationId = state.importData?.operationId, epoch = state.importEpoch;
  if(!operationId) return;
  state.classifierDetailRow=null;state.classifierRevealed={};
  state.importStep='loading'; state.importRequest=operationId; renderView();
  try {
    await window.blego.reclassify({operationId,options:classificationOptions()});
    if(state.importEpoch !== epoch) return;
    state.classifierQuery=''; state.classifierDescending=false;
    state.importStep='preview'; await importPage(0);
  } catch {if(state.importEpoch===epoch) {state.importStep='preview';toast('Не удалось применить соответствие', 'err');}}
  finally {if(state.importEpoch===epoch) {state.importRequest=null;renderView();}}
}

let newsRequest = 0;
function ensureNews() {
  if (state.view !== 'news' || !state.settings.newsEnabled) return;
  if (!state.news.lastAttemptAt && !state.news.loading) refreshNews(false);
}
async function refreshNews(force) {
  const topic=state.news.topic, request=++newsRequest;
  state.news.loading=true;state.news.error='';updateNews();
  try {
    if (!state.settings.newsEnabled) state.settings=await window.blego.updateSettings({newsEnabled:true});
    if(request!==newsRequest||state.news.topic!==topic)return;
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
  const topic=newsTopic(event.target.value), request=++newsRequest;
  state.news.topic=topic;state.news.items=[];state.news.lastAttemptAt=null;state.news.loading=true;state.news.error='';updateNews();
  try {
    await window.blego.updateSettings({newsTopic:topic});
    if(request!==newsRequest||state.news.topic!==topic)return;
    const cached=await window.blego.newsSnapshot(topic);
    if(request!==newsRequest||state.news.topic!==topic)return;
    Object.assign(state.news,cached);state.news.updatedAt=cached.lastSuccessfulAt?Date.parse(cached.lastSuccessfulAt):0;
    if(state.settings.newsEnabled) refreshNews(false); else {state.news.loading=false;updateNews();}
  }catch {if(request!==newsRequest)return;state.news.loading=false;state.news.error='Could not load this topic.';updateNews();}
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
  if (full) {n.speed = null;n.speedRoute='direct';}
  else {
    n.ping = null;
    n.ip = null;
  }
  renderView();
  try {
    state.settings = await window.blego.updateSettings({ proxyEnabled: true });
    controller.signal.throwIfAborted();
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
    if(controller.signal.aborted&&full)n.speed=null;
    n.error = controller.signal.aborted ? 'Check cancelled.' : 'Connection test failed. Try again.';
  } finally {
    n.running = false;
    n.stage = '';
    if (networkController === controller) networkController = null;
    renderView();
  }
}

async function runProxyCheck(fullTest = false) {
  if (!state.settings.proxyEnabled || state.network.proxyLoading || state.network.running) return;
  const value = state.network.proxyInput.trim();
  state.network.proxyFullTest = fullTest;
  if(fullTest){state.network.speed=null;state.network.speedRoute=value?'proxy':'direct';}
  const reputation = document.getElementById('proxy-reputation')?.checked === true;
  state.network.reputation = reputation;
  state.network.proxyLoading = true;
  state.network.proxy = null;
  state.network.proxyError = '';
  renderView();
  try {
    const result = await checkProxy(value, { reputation, fullTest });
    if(value === state.network.proxyInput.trim()){state.network.proxy=result;if(fullTest)state.network.speed=result.speed;}
    else state.network.proxyError='Адрес изменился. Повторите проверку.';
  } catch (error) {
    state.network.proxy = null;
    state.network.proxyError = error.message === 'CANCELLED' ? 'Проверка отменена' : `Не удалось проверить прокси: ${error.message}`;
  }
  state.network.proxyLoading = false;
  renderView();
}

async function addPhotos(droppedFiles, folders = false) {
  if (state.imagesBusy) return;
  stashImageDraft();
  state.imagesBusy = true;
  state.imagesReading = true;
  state.imagesReadCancelled = false;
  state.imageScan = null;
  renderView();
  const stopScan = window.blego.onImageScan((progress) => {
    state.imageScan = progress;
    const element=document.getElementById('image-scan-status');
    if(element) element.textContent=`Найдено: ${progress.found} · Пропущено: ${progress.skipped} · Повторов: ${progress.duplicates}`;
  });
  let lastReadRender = 0;
  try {
    const files = droppedFiles ? await window.blego.addDroppedImages(Array.from(droppedFiles)) : folders ? await window.blego.chooseImageFolders() : await window.blego.chooseImages();
    state.photos.push(...files);
    state.metadataPresets = await window.blego.metadataPresets();
    state.imageWorkspace = await window.blego.imageWorkspace();
    for (const file of files) {
      if (state.imagesReadCancelled) {
        file.status = 'cancelled';
        continue;
      }
      file.status = 'reading';
      if(Date.now()-lastReadRender>=150){renderView();lastReadRender=Date.now();}
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
    if(state.photoMap)state.photoMap.view=null;
    stopScan();
    restoreImageDraft();
    renderView();
  }
}
async function removePhoto(id) {
  invalidateImagePreview();
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
  invalidateImagePreview();
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
    if(state.view==='photos'&&target.dataset.view!=='photos')invalidateImagePreview();
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
  if (action === 'classifier-copy-row' || action === 'classifier-copy-table') {
    const operationId=state.importData?.operationId, epoch=state.importEpoch;
    try {
      const text=await window.blego.classifierExportText({operationId,recordId:action==='classifier-copy-row'?target.dataset.row:undefined,format:'tsv'});
      if(state.importEpoch===epoch && state.importData?.operationId===operationId) await copyText(text,target);
    } catch {toast('Не удалось скопировать результат','err');}
    return;
  }
  if (action === 'classifier-export') {
    try {
      const result=await window.blego.classifierExportFile({operationId:state.importData.operationId,format:target.dataset.format});
      if(result.ok) toast('Файл сохранён');
    } catch {toast('Не удалось сохранить файл. Выберите новое имя и проверьте доступ к папке.','err');}
    return;
  }
  if (action === 'classifier-archive') {
    const operationId=state.importData?.operationId, epoch=state.importEpoch;
    target.disabled=true;
    try {
      await window.blego.confirmClassification({operationId,decision:state.importData.status==='preview_partial'?'accept_partial':'accept_complete'});
      if(state.importEpoch!==epoch) return;
      await window.blego.saveArchive(operationId);
      if(state.importEpoch!==epoch) return;
      state.importSaved=true;await importPage(state.importData.offset);toast('Сохранено');
    } catch {toast('Не удалось сохранить архив','err');target.disabled=false;}
    return;
  }
  if(action==='classifier-facebook-link'){try{await window.blego.linkFacebookImport({operationId:state.importData?.operationId,recordId:target.dataset.row});toast('Локальные сведения связаны; проверка Facebook не выполнялась');}catch{toast('Не удалось связать сведения. Проверьте ID и ссылку профиля.','err');}return;}
  if(action==='classifier-details'){state.classifierDetailRow=target.dataset.row;state.classifierRevealed={};renderView();document.getElementById('classifier-record-details')?.scrollIntoView({block:'nearest'});return;}
  if(action==='classifier-close-details'){state.classifierDetailRow=null;state.classifierRevealed={};renderView();return;}
  if(action==='classifier-reveal'){
    if(target.dataset.row!==state.classifierDetailRow)return;
    state.classifierRevealed ||= {};
    const key=target.dataset.field; state.classifierRevealed[key]=!state.classifierRevealed[key];
    const open=[...document.querySelectorAll('#classifier-record-details details')].map(d=>d.open);
    renderView();document.querySelectorAll('#classifier-record-details details').forEach((d,i)=>{d.open=open[i];});return;
  }
  if(action==='classifier-apply-record'){await reclassifyInput();return;}
  if (action === 'classifier-apply') {await reclassifyInput(); return;}
  if (action === 'classifier-filter') {state.classifierQuery=document.getElementById('classifier-query')?.value || '';await importPage(0);return;}
  if (action === 'import-cookie-copy' || action === 'classifier-copy-cell') {
    const operationId = state.importData?.operationId, epoch=state.importEpoch;
    try {
      const full = await window.blego.importCell({operationId, recordId:target.dataset.row, field:target.dataset.field});
      if (state.importEpoch!==epoch || state.importData?.operationId!==operationId) return;
      if(full) await copyText(full,target);
    } catch {toast('Не удалось скопировать выбранное поле','err');}
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
    invalidateImportCopies();
    state.importEpoch = (state.importEpoch || 0) + 1;
    state.classifierQuery=''; state.classifierDescending=false; state.classifierExtraOpen=false;
    state.classifierDetailRow=null;state.classifierRevealed={};state.classifierWarningsOnly=false;
    if(state.classifierOptions)state.classifierOptions.recordMapping={};
    if(state.classifierOptions) state.classifierOptions.mapping={};
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
    newsRequest++;state.news.loading=false;state.news.error='Update cancelled.';updateNews();
    window.blego.cancelNews().catch(()=>toast('Cancellation could not be confirmed.','err'));
    return;
  }
  if (action === 'news-refresh') {
    refreshNews(true);
    return;
  }
  if (action === 'net-enable') {
    try {
      state.settings = await window.blego.updateSettings({ proxyEnabled: true });
      renderView();
      await runNetwork(false);
    } catch (error) {
      toast('Не удалось включить проверку сети: ' + error.message, 'err');
    }
    return;
  }
  if(action==='net-cancel'){networkController?.abort();await window.blego.cancelProxy();return;}
  if (action === 'net-ping') {
    runNetwork(false);
    return;
  }
  if (action === 'net-run') {
    runNetwork(true);
    return;
  }
  if (action === 'proxy-reveal') {
    const input = document.getElementById('proxy-input');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
      target.textContent = input.type === 'password' ? 'Показать' : 'Скрыть';
    }
    return;
  }
  if (action === 'proxy-cancel') {
    window.blego.cancelProxy();
    return;
  }
  if (action === 'proxy-key-save' || action === 'proxy-key-clear') {
    const input = document.getElementById('proxy-api-key');
    const value = action === 'proxy-key-clear' ? '' : input?.value;
    if (input) input.value = '';
    try { await window.blego.saveProxyKey(value); toast(action === 'proxy-key-clear' ? 'Ключ удалён' : 'Ключ сохранён'); } catch (e) { toast(e.message === 'SECURE_STORAGE_UNAVAILABLE' ? 'Защищённое хранилище недоступно. Проверка без ключа доступна.' : 'Не удалось сохранить ключ', 'err'); }
    return;
  }
  if (action === 'proxy-speed') { runProxyCheck(true); return; }
  if (action === 'proxy-check') {
    runProxyCheck();
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
      toast(imageErrorMessage(error.message), 'err');
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
    if(state.geoBusy){await window.blego.cancelGeo(state.geoBusy);return;}
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
      toast(imageErrorMessage(error.message), 'err');
    } finally {
      unsubscribe?.();
      state.imagesBusy = false;
      renderView();
    }
    return;
  }
  if(action==='geo-generate'||action==='geo-regenerate-one'){
    if(state.imagesBusy)return;
    const ids=action==='geo-regenerate-one'?[target.dataset.id]:state.photos.filter(p=>p.selected&&p.view?.capabilities.writable).map(p=>p.fileId);
    const old=state.imageWorkspace?.overrides[ids[0]]?.find(o=>o.origin?.kind==='geo');
    const cityId=action==='geo-regenerate-one'?(state.geoCatalogue?.cities.find(c=>c.id.replace(/:/g,'_')===old?.origin.id)?.id):state.geoCity;
    const requestId=crypto.randomUUID();
    state.geoBusy=requestId;state.imagesBusy=true;
    try{
      await state.imageInvalidation;
      await applyImageForm({excludeGPS:true});
      renderView();
      const result=await window.blego.generateImageGeo({cityId,fileIds:ids,requestId});
      state.photoMap={...(state.photoMap||{}),mode:'after',view:null};
      state.imageWorkspace=result.workspace;state.metadataPlan=null;
      if(state.imageDrafts)delete state.imageDrafts[state.imageDraftKey];restoreImageDraft();
      toast(`GEO создано для ${ids.length} фото`);
    }catch(e){toast(imageErrorMessage(e.message),'err');}
    finally{state.geoBusy=null;state.imagesBusy=false;renderView();}return;
  }
  if(action==='geo-import'||action==='geo-import-confirm'){
    try{
      stashImageDraft();
      if(action==='geo-import')state.geoImportPreview=await window.blego.importGeo();
      else{await window.blego.confirmGeoImport(state.geoImportPreview.token);state.geoImportPreview=null;state.geoCatalogue=await window.blego.geoCatalog();toast('Каталог сохранён');}
      renderView();
    }catch(e){toast(imageErrorMessage(e.message),'err');}return;
  }
  if (action === 'images-folder') { await addPhotos(null, true); return; }
  if (action === 'photo-page') { stashImageDraft(); state.photoPage=Number(target.dataset.page)||0; renderView(); return; }
  if (action === 'images-choose'  || action === 'images-browse') {
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
  if(action==='image-preview-close'){stashImageDraft();invalidateImagePreview();renderView();return;}
  if (action === 'image-preview') {
    const request=++imagePreviewRequest, fileId=target.dataset.id;
    try {
      const preview=await window.blego.previewImage(fileId);
      const photo=state.photos.find(p=>p.fileId===fileId);
      if(request!==imagePreviewRequest||!photo||state.view!=='photos')return;
      stashImageDraft();state.imagePreview=preview;state.imagePreviewName=photo.name;
      renderView();
    } catch (error) {
      if(request===imagePreviewRequest)toast(imageErrorMessage(error.message), 'err');
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
  if(action==='friends-import') {
    if(state.friendsBusy)return;state.friendsBusy=true;renderView();
    try {state.friendsPreview=await window.blego.importFriends();state.friendsPreviewPage=0;}
    catch(error){toast(error.message==='FRIENDS_CREDENTIAL_FIELDS'?'Файлы с полями авторизации не подходят для Friends.':error.message==='FRIENDS_INPUT_LIMIT'?'Выберите TXT, CSV или JSON до 5 МиБ и 5000 записей.':'Не удалось прочитать список Friends. Проверьте формат и ссылки.','err');}
    finally {state.friendsBusy=false;renderView();}return;
  }
  if(action==='friends-confirm') {
    if(!state.friendsPreview||state.friendsBusy)return;state.friendsBusy=true;
    try {const result=await window.blego.confirmFriends(state.friendsPreview.token);state.friendsRows=result.rows;state.friendsPreview=null;toast(`Добавлено: ${result.added}`);}
    catch {toast('Не удалось сохранить Friends. Повторите предпросмотр.','err');}
    finally {state.friendsBusy=false;renderView();}return;
  }
  if(action==='friends-cancel'){if(state.friendsPreview)await window.blego.cancelFriends(state.friendsPreview.token);state.friendsPreview=null;renderView();return;}
  if(action==='friends-open'){try{await window.blego.openFriend(target.dataset.id);}catch{toast('Не удалось открыть выбранную ссылку.','err');}return;}
  if(action==='friends-page'||action==='friends-preview-page'){state[action==='friends-page'?'friendsPage':'friendsPreviewPage']=Number(target.dataset.page)||0;renderView();return;}
  if (action === 'friends-geo') {
    state.friendsGeo = target.dataset.geo || '';state.friendsPage=0;
    renderView();
    return;
  }
  if(action==='checker-retry-one'){if(state.checker.checking)return;const row=state.checker.rows?.[Number(target.dataset.index)];if(!row?.link)return;for(const other of state.checker.rows)if(other.link===row.link)other.check=null;await runCheckerStatus(crypto.randomUUID(),row.link);return;}
  if (action === 'checker-run') {
    if(state.checker.checking)return;
    const runId=crypto.randomUUID(),input=state.checker.input;
    state.checker.runId=runId;state.checker.rows=null;state.checker.cancelled=false;state.checker.statusFilter='';
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
      state.checker.checking=null;renderView();toast('Не удалось начать проверку. Введите до 100 ID или прямых ссылок.','err');
    }
    return;
  }
  if (action === 'checker-cancel') {
    state.checker.runId=null;state.checker.checking=null;state.checker.cancelled=true;
    for(const row of state.checker.rows||[])if(row.link&&!row.check)row.check={status:'CANCELLED',availability:'cancelled',reasonCode:'CANCELLED',source:'request_queue',checkedAt:null};
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

async function runCheckerStatus(runId = crypto.randomUUID(), onlyTarget=null) {
  const rows = state.checker.rows;
  if (!rows || state.checker.checking) return;
  const targets = rows.filter((row) => row.link && (!onlyTarget || row.link===onlyTarget));
  state.checker.runId = runId;
  state.checker.checking = { done: 0, total: new Set(targets.map((row) => row.link)).size };
  renderView();
  try {
    const result = await checkProfiles(targets, runId, (done, total, result) => {
      if (state.checker.runId !== runId) return;
      for(const row of rows)if(row.link===result.canonicalUrl)row.check=result;
      state.checker.checking = { done, total };
      const label = document.getElementById('checker-progress-text');
      if (label) label.textContent = `Проверено ${done} из ${total}`;
      const fill = document.getElementById('checker-progress-fill');
      if (fill) fill.style.width = `${(100 * done) / total}%`;
    });
    if (state.checker.runId !== runId) return;
    for (const row of state.checker.rows || []){const found=result.results.find(value=>value.canonicalUrl===row.link);if(found)row.check=found;}
  } catch (error) {
    if (state.checker.runId === runId) toast('Не удалось завершить проверку. Повторите попытку.', 'err');
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
    state.geoCatalogue=await window.blego.geoCatalog();
    await initCopyPreferences();
    state.locale = state.settings.country;
    state.type = state.settings.type;
    await refreshPoolStats();
    state.demo = await window.blego.lastCard();
    state.friendsRows = await window.blego.friendsList();
    state.news.topic = newsTopic(state.settings.newsTopic);
    const cached = await window.blego.newsSnapshot(state.news.topic);
    Object.assign(state.news, cached);
    state.news.updatedAt = cached.lastSuccessfulAt ? Date.parse(cached.lastSuccessfulAt) : 0;
    window.blego.onNews((data) => {
      if(data.topic !== state.news.topic) return;
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
    shouldStart: () => !workspaceInteracted,
    navigate: (view) => {
      state.view = view;
      renderView();
    }
  });
}, 700);
