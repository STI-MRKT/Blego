import { state } from './state.js';
import { $ } from './utils/dom.js';
import { pad2 } from './utils/random.js';
import { toast } from './utils/toast.js';
import { copyText } from './utils/clipboard.js';
import { appHTML } from './ui/shell.js';
import { viewHTML } from './ui/views.js';
import { renderModal } from './ui/modal.js';
import { startTour } from './ui/tour.js';
import { historyRowsHTML, historyFiltered } from './ui/history.js';
import { newsBlockHTML } from './ui/news.js';
import { PHOTO_LIMIT } from './ui/photos.js';
import { makeDemo } from './services/generator.js';
import { parseFile, importErrorMessage } from './services/importer.js';
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

function bindView() {
  document.querySelectorAll('[data-input="locale"]').forEach((select) => {
    select.onchange = (event) => { state.locale = event.target.value; };
  });
  const search = document.getElementById('history-search');
  if (search) {
    search.oninput = (event) => {
      state.historyQuery = event.target.value;
      const list = document.getElementById('history-list');
      if (list) list.innerHTML = historyRowsHTML();
      const counter = document.getElementById('history-count');
      if (counter) counter.textContent = `${historyFiltered().length} of ${state.history.length}`;
    };
  }
  const proxy = document.getElementById('proxy-input');
  if (proxy) {
    proxy.oninput = (event) => { state.network.proxyInput = event.target.value; };
  }
  const checker = document.getElementById('checker-input');
  if (checker) {
    checker.oninput = (event) => {
      state.checker.input = event.target.value;
      const count = event.target.value.trim() ? event.target.value.trim().split(/[\s,;|]+/).filter(Boolean).length : 0;
      const label = document.getElementById('checker-count');
      if (label) label.textContent = `${count} tokens`;
      const button = document.querySelector('[data-action="checker-run"]');
      if (button) button.disabled = !event.target.value.trim();
    };
  }
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
  ['dragenter', 'dragover'].forEach((name) => zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, (event) => {
    event.preventDefault();
    zone.classList.remove('over');
  }));
  zone.addEventListener('drop', (event) => {
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (id === 'photo-drop') onFiles(files[0], files);
    else onFiles(files[0]);
  });
}

function generate() {
  if (state.demoBusy) return;
  state.demoBusy = true;
  renderView();
  setTimeout(() => {
    state.demo = makeDemo(state.locale);
    state.demoBusy = false;
    renderView();
    toast('New demo set generated');
  }, 780);
}

function handleFile(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!['csv', 'tsv', 'json'].includes(extension)) {
    state.importStep = 'error';
    state.importName = file.name;
    state.importError = importErrorMessage('ext');
    if (state.view !== 'import') state.view = 'import';
    renderAll();
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    state.importStep = 'error';
    state.importName = file.name;
    state.importError = importErrorMessage('size');
    if (state.view !== 'import') state.view = 'import';
    renderAll();
    return;
  }
  state.importName = file.name;
  state.importKind = extension.toUpperCase();
  state.importStep = 'loading';
  if (state.view !== 'import') state.view = 'import';
  renderAll();
  const reader = new FileReader();
  reader.onload = () => {
    setTimeout(() => {
      const result = parseFile(String(reader.result || ''), extension);
      if (result.error) {
        state.importStep = 'error';
        state.importError = importErrorMessage(result.error);
      } else {
        state.importData = result;
        state.importStep = 'preview';
      }
      renderView();
    }, 850);
  };
  reader.onerror = () => {
    state.importStep = 'error';
    state.importError = 'Couldn’t read the file.';
    renderView();
  };
  reader.readAsText(file);
}

function loadSample() {
  const sample = [
    'project;owner;email;note;status',
    'Q4 Launch;Camille Moreau;camille.moreau@example.com;Hero assets ready;active',
    'Brand Refresh;Lucas Silva;lucas.silva@example.com;Awaiting copy;active',
    'Creator Batch 12;;maya.chen@example.com;Needs owner;draft',
    'Marketplace Test;Jakub Kowalski;jakub.kowalski[at]example.com;Typo in email;paused',
    'Spring Campaign;Ana Souza;ana.souza@example.com;Rerun after review;draft',
    'Portfolio Sync;Noah Bennett;noah.bennett@example.com;Waiting on legal;active',
    'Local Pages;Zofia Nowak;zofia.nowak@example.com;;active'
  ].join('\n');
  state.importName = 'brand_pages_sample.csv';
  state.importKind = 'CSV';
  state.importStep = 'loading';
  renderView();
  setTimeout(() => {
    const result = parseFile(sample, 'csv');
    if (result.error) {
      state.importStep = 'error';
      state.importError = importErrorMessage(result.error);
    } else {
      state.importData = result;
      state.importStep = 'preview';
    }
    renderView();
  }, 800);
}

function saveImport() {
  const data = state.importData;
  if (!data) return;
  const problems = data.rows.filter((row) => row.level !== 'ok').length;
  const entry = {
    id: `e${Date.now()}`,
    name: state.importName,
    kind: state.importKind || 'CSV',
    date: Date.now(),
    status: problems ? 'partial' : 'parsed',
    columns: data.columns,
    rows: data.rows.map((row) => ({ ...row.data }))
  };
  state.history.unshift(entry);
  state.importSaved = { name: entry.name, rowCount: entry.rows.length, problems };
  state.importStep = 'saved';
  renderView();
  toast('Saved to history');
}

function ensureNews() {
  if (!state.news.updatedAt && !state.news.loading) refreshNews(false);
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
    state.news.updatedAt = data.fetchedAt;
    state.news.order = shuffle(data.items.map((item) => item.link));
    state.news.error = data.error || (data.items.length ? '' : 'News sources did not respond. Check the connection and try again.');
  } catch (error) {
    void error;
    state.news.error = 'News is unavailable. Check the connection and try again.';
  }
  state.news.loading = false;
  updateNews();
}

function updateNews() {
  const block = document.getElementById('news-block');
  if (block) block.outerHTML = newsBlockHTML();
}

function maybeAutoNetwork() {
  if (state.view !== 'network') return;
  if (document.getElementById('tour-root')) return;
  if (state.network.ip || state.network.running || state.network.error) return;
  runNetwork(false);
}

async function runNetwork(full) {
  if (state.network.running) return;
  state.network.running = true;
  state.network.stage = 'Pinging';
  state.network.error = '';
  renderView();
  const [infoResult, ipResult, pingResult] = await Promise.allSettled([getNetworkInfo(), getIpInfo(), getPing()]);
  state.network.info = infoResult.status === 'fulfilled' ? infoResult.value : null;
  state.network.ip = ipResult.status === 'fulfilled' ? ipResult.value : null;
  state.network.ping = pingResult.status === 'fulfilled' ? pingResult.value : null;
  if (!state.network.ip) state.network.error = 'IP lookup failed. Check the connection and run the test again.';
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
  if (state.network.proxyLoading) return;
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

function addPhotos(files) {
  const list = [...files].filter((file) => file && file.type.startsWith('image/'));
  if (!list.length) {
    toast('Only image files are supported', 'err');
    return;
  }
  const room = PHOTO_LIMIT - state.photos.length;
  const accepted = list.slice(0, room);
  accepted.forEach((file) => {
    state.photos.push({
      id: `p${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file)
    });
  });
  if (list.length > room) toast(`Limit is ${PHOTO_LIMIT} photos — ${list.length - room} skipped`, 'err');
  else toast(`${accepted.length} photo${accepted.length === 1 ? '' : 's'} added`);
  renderView();
}

function removePhoto(id) {
  const photo = state.photos.find((entry) => entry.id === id);
  if (photo) URL.revokeObjectURL(photo.url);
  state.photos = state.photos.filter((entry) => entry.id !== id);
  renderView();
}

function clearPhotos() {
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.photos = [];
  renderView();
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'set-view') {
    state.view = target.dataset.view;
    state.modal = null;
    renderAll();
    return;
  }
  if (action === 'generate') { generate(); return; }
  if (action === 'clear-demo') {
    state.demo = null;
    renderView();
    toast('Set cleared');
    return;
  }
  if (action === 'copy') { copyText(target.dataset.copy || '', target); return; }
  if (action === 'cell-expand') {
    const cell = target.closest('td');
    if (cell) cell.classList.toggle('expanded');
    return;
  }
  if (action === 'import-sample') { loadSample(); return; }
  if (action === 'import-reset') {
    state.importStep = 'idle';
    state.importData = null;
    state.importName = '';
    state.importError = '';
    state.importSaved = null;
    renderView();
    return;
  }
  if (action === 'import-save') { saveImport(); return; }
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
  if (action === 'news-refresh') { refreshNews(true); return; }
  if (action === 'news-topic') {
    state.news.topic = target.dataset.topic || '';
    if (!state.news.topic && !state.news.order.length) {
      state.news.order = shuffle(state.news.items.map((item) => item.link));
    }
    updateNews();
    return;
  }
  if (action === 'net-run') { runNetwork(true); return; }
  if (action === 'proxy-check') { runProxyCheck(); return; }
  if (action === 'photo-remove') { removePhoto(target.dataset.id); return; }
  if (action === 'photos-clear') { clearPhotos(); return; }
  if (action === 'friends-geo') {
    state.friendsGeo = target.dataset.geo || '';
    renderView();
    return;
  }
  if (action === 'checker-run') {
    state.checker.rows = parseIds(state.checker.input);
    renderView();
    return;
  }
  if (action === 'checker-status') {
    runCheckerStatus();
    return;
  }
  if (action === 'checker-clear') {
    state.checker = { input: '', rows: null };
    renderView();
  }
});

async function runCheckerStatus() {
  const rows = state.checker.rows;
  if (!rows || state.checker.checking) return;
  const targets = rows.filter((row) => row.link && row.type !== 'invalid');
  if (!targets.length) return;
  state.checker.checking = { done: 0, total: targets.length };
  renderView();
  const results = await checkProfiles(targets.map((row) => row.id), (done, total) => {
    state.checker.checking = { done, total };
    const label = document.getElementById('checker-progress-text');
    if (label) label.textContent = `Checking live status ${done} of ${total}`;
    const fill = document.getElementById('checker-progress-fill');
    if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
  });
  for (const row of state.checker.rows) {
    const result = results.get(row.id);
    if (result) row.check = result;
  }
  state.checker.checking = null;
  renderView();
}

setInterval(() => {
  if (!state.demo) return;
  const left = state.demo.expiresAt - Date.now();
  if (left <= 0) {
    state.demo = null;
    if (state.view === 'generator') renderView();
    toast('Demo set expired and cleared');
    return;
  }
  const seconds = Math.floor(left / 1000);
  const text = `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
  const card = document.getElementById('ttl');
  const head = document.getElementById('ttl-top');
  if (card) card.textContent = text;
  if (head) head.textContent = text;
}, 1000);

renderAll();
setTimeout(() => {
  startTour({
    navigate: (view) => {
      state.view = view;
      renderView();
    }
  });
}, 700);
