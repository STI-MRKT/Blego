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
import { readMetadataForm } from './ui/photos.js';
import { makeDemo } from './services/generator.js';
import { importErrorMessage } from './services/importer.js';
import { loadNews } from './services/news.js';
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
function bindView() {
  mountCopyActions();
  document.querySelectorAll('[data-image-select]').forEach((input) => {
    input.onchange = () => {
      const photo = state.photos.find((p) => p.fileId === input.dataset.imageSelect);
      photo.selected = input.checked;
      state.metadataPlan = null;
      state.metadataDraft = null;
      renderView();
    };
  });
  const metadataForm = document.getElementById('metadata-form');
  if (metadataForm) {
    for (const [key, value] of Object.entries(state.metadataDraft || {})) {
      const control = metadataForm.elements.namedItem(key);
      if (control) {
        if (control.type === 'checkbox') control.checked = value;
        else control.value = value;
      }
    }
    metadataForm.oninput = () => {
      state.metadataDraft = Object.fromEntries(new FormData(metadataForm));
      state.metadataDraft['confirm-maker'] =
        metadataForm.elements.namedItem('confirm-maker').checked;
      state.metadataPlan = null;
      document.querySelector('[data-metadata-plan]')?.remove();
    };
    metadataForm.onsubmit = async (event) => {
      event.preventDefault();
      try {
        state.metadataPlan = await window.blego.planMetadataChanges({
          fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId),
          operations: readMetadataForm(metadataForm),
          acknowledgeMakerNotes: new FormData(metadataForm).has('confirm-maker')
        });
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
  if (!state.settings.newsEnabled) return;
  if (!state.news.lastAttemptAt && !state.news.loading) refreshNews(false);
}

async function refreshNews(force) {
  if (state.news.loading) return;
  state.news.loading = true;
  state.news.error = '';
  updateNews();
  try {
    const data = await loadNews(force);
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
  updateNews();
}

function updateNews() {
  const block = document.getElementById('news-block');
  if (block) {
    const selection = window.getSelection();
    if (
      block.contains(document.activeElement) ||
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
  state.imagesBusy = true;
  state.imagesReading = true;
  state.imagesReadCancelled = false;
  renderView();
  try {
    const files = await window.blego.chooseImages();
    state.photos.push(...files);
    state.metadataPresets = await window.blego.metadataPresets();
    for (const file of files) {
      if (state.imagesReadCancelled) {
        file.status = 'cancelled';
        continue;
      }
      file.status = 'reading';
      renderView();
      try {
        file.view = await window.blego.readImageMetadata(file.fileId);
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
    renderView();
  }
}
async function removePhoto(id) {
  try {
    await window.blego.removeImage(id);
    state.photos = state.photos.filter((photo) => photo.fileId !== id);
    state.metadataPlan = null;
    state.imagePreview = null;
    renderView();
  } catch (error) {
    toast(error.message, 'err');
  }
}
async function clearPhotos() {
  try {
    await window.blego.clearImages();
    state.photos = [];
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
  if (action === 'news-topic') {
    state.news.topic = target.dataset.topic || '';
    window.blego.updateSettings({ newsTopic: state.news.topic });
    if (!state.news.topic && !state.news.order.length) {
      state.news.order = shuffle(state.news.items.map((item) => item.link));
    }
    updateNews();
    return;
  }
  if (action === 'net-run') {
    runNetwork(true);
    return;
  }
  if (action === 'proxy-cancel') {
    window.blego.cancelProxy();
    return;
  }
  if (action === 'proxy-check') {
    runProxyCheck();
    return;
  }
  if (action === 'metadata-cancel') {
    if (state.imagesReading) state.imagesReadCancelled = true;
    await window.blego.cancelImageExport();
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
      const planId = state.metadataPlan.planId,
        destinationToken = await window.blego.chooseImageDestination();
      if (!destinationToken) return;
      state.imagesBusy = true;
      state.metadataExport = null;
      state.metadataProgress = {};
      renderView();
      unsubscribe = window.blego.onImageProgress((result) => {
        state.metadataProgress[result.fileId] = result;
        if (state.view === 'photos') renderView();
      });
      state.metadataExport = await window.blego.applyMetadataPlan({ planId, destinationToken });
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
      state.metadataPlan = await window.blego.planMetadataChanges({
        fileIds: state.photos.filter((p) => p.selected).map((p) => p.fileId),
        presetId: document.getElementById('metadata-preset').value,
        acknowledgeMakerNotes: new FormData(document.getElementById('metadata-form')).has(
          'confirm-maker'
        )
      });
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
