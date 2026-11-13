import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import {
  photoMapRows,
  fitMap,
  project,
  unproject,
  clusterPoints
} from '../../../shared/photo-map.mjs';
let dispose = () => {};
const boundaries = new Map();
export function photoMapHTML() {
  if (!state.photos.length) return '';
  const mode = state.photoMap?.mode || 'before';
  return `<section class="card photo-map" aria-label="Карта фотографий"><div class="head-actions"><h3>Местоположение</h3><button class="btn" data-map-action="before" aria-pressed="${mode === 'before'}">До</button><button class="btn" data-map-action="after" aria-pressed="${mode === 'after'}">После</button><button class="btn" data-map-action="zoom-in" aria-label="Приблизить карту">+</button><button class="btn" data-map-action="zoom-out" aria-label="Отдалить карту">−</button><button class="btn" data-map-action="fit">Показать все</button></div><p class="sub">Локальные контуры · без уличной подложки · © OpenStreetMap contributors</p><canvas id="photo-map-canvas" tabindex="0" aria-label="Карта GPS. Стрелки перемещают карту, плюс и минус меняют масштаб."></canvas><p class="sub" id="photo-map-status" role="status"></p><label class="fl">Фотография<select class="input" id="photo-map-select"><option value="">Выберите фотографию</option></select></label><div id="photo-map-inspector"></div><p class="sub">Выбранную точку в режиме «После» можно перетащить внутри выбранного города. Точные координаты — в дополнительных полях GEO.</p></section>`;
}
export function mountPhotoMap({ onMove, onError } = {}) {
  dispose();
  const canvas = document.getElementById('photo-map-canvas');
  if (!canvas) {
    dispose = () => {};
    return;
  }
  const panel = canvas.closest('.photo-map'),
    select = document.getElementById('photo-map-select');
  const model = (state.photoMap ||= { mode: 'before', view: null, selected: null });
  const rows = photoMapRows(state.photos, state.imageWorkspace),
    cityId = state.geoCity;
  let geometry = boundaries.get(cityId)?.geometry || null,
    closed = false,
    frame = 0,
    width = 1,
    height = 1,
    clusters = [],
    drag = null,
    geometryRequest = null;
  const context = canvas.getContext('2d');
  const color = getComputedStyle(document.documentElement);
  const palette = {
    text: color.getPropertyValue('--text').trim() || '#dfe5f1',
    muted: color.getPropertyValue('--muted').trim() || '#8b95a9',
    accent: color.getPropertyValue('--accent').trim() || '#9383ff',
    border: color.getPropertyValue('--border').trim() || '#334155',
    panel: color.getPropertyValue('--panel').trim() || '#151923'
  };
  const points = () =>
    rows.filter((r) => r[model.mode]).map((r) => ({ id: r.id, ...r[model.mode] }));
  const fit = () => {
    model.view = fitMap(points(), model.mode === 'after' ? geometry : null, width, height);
    schedule();
  };
  function schedule() {
    if (!closed && !frame) frame = requestAnimationFrame(draw);
  }
  function selectPhoto(id) {
    model.selected = id || null;
    select.value = id || '';
    for (const card of document.querySelectorAll('[data-photo-id]'))
      card.classList.toggle('map-selected', card.dataset.photoId === id);
    const row = rows.find((r) => r.id === id),
      inspector = document.getElementById('photo-map-inspector');
    const coordinate = (p) => (p ? `${p.latitude}, ${p.longitude}` : 'Без GEO');
    inspector.innerHTML = row
      ? `${/^data:image\/(?:png|jpeg|webp);base64,/u.test(row.thumbnail || '') ? `<img src="${esc(row.thumbnail)}" alt="${esc(row.name)}">` : ''}<p><b>${esc(row.name)}</b><br>До: ${esc(coordinate(row.before))}<br>После: ${esc(coordinate(row.after))}<br>${esc(row.status)}</p>`
      : '';
    schedule();
  }
  select.replaceChildren(
    new Option('Выберите фотографию', ''),
    ...rows.map((row) => new Option(`${row.name}${row.before ? '' : ' · Без GEO'}`, row.id))
  );
  select.onchange = () => {
    selectPhoto(select.value);
    const row = rows.find((r) => r.id === select.value);
    if (row?.[model.mode]) {
      model.view ||= fitMap(points(), null, width, height);
      model.view.center = { ...row[model.mode] };
      schedule();
    }
  };
  function draw() {
    frame = 0;
    if (closed) return;
    const rect = canvas.getBoundingClientRect(),
      ratio = Math.min(2, devicePixelRatio || 1);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    model.view ||= fitMap(points(), model.mode === 'after' ? geometry : null, width, height);
    const view = model.view,
      point = (p) => project(p, view, width, height);
    context.fillStyle = palette.panel;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = palette.border;
    context.lineWidth = 1;
    const step = 10 ** Math.floor(Math.log10(100 / view.scale));
    const topLeft = unproject({ x: 0, y: 0 }, view, width, height),
      bottomRight = unproject({ x: width, y: height }, view, width, height);
    context.beginPath();
    for (
      let lon = Math.ceil(topLeft.longitude / step) * step;
      lon < bottomRight.longitude && lon <= 180;
      lon += step
    ) {
      if (lon < -180) continue;
      const p = point({ longitude: lon, latitude: 0 });
      context.moveTo(p.x, 0);
      context.lineTo(p.x, height);
    }
    for (
      let lat = Math.ceil(bottomRight.latitude / step) * step;
      lat < topLeft.latitude && lat <= 90;
      lat += step
    ) {
      if (lat < -90) continue;
      const p = point({ longitude: 0, latitude: lat });
      context.moveTo(0, p.y);
      context.lineTo(width, p.y);
    }
    context.stroke();
    if (geometry) {
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      context.strokeStyle = palette.accent;
      context.lineWidth = 1.5;
      for (const polygon of polygons) {
        context.beginPath();
        for (const ring of polygon) {
          ring.forEach(([longitude, latitude], i) => {
            const p = point({ longitude, latitude });
            i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y);
          });
          context.closePath();
        }
        context.globalAlpha = 0.12;
        context.fillStyle = palette.accent;
        context.fill('evenodd');
        context.globalAlpha = 0.8;
        context.stroke();
        context.globalAlpha = 1;
      }
    }
    const current = points();
    if (drag?.kind === 'marker' && drag.moved) {
      const p = current.find((p) => p.id === model.selected);
      if (p) Object.assign(p, unproject(drag.current, view, width, height));
    }
    clusters = clusterPoints(current, view, width, height);
    for (const cluster of clusters) {
      const radius = cluster.ids.length > 1 ? 15 : 6;
      context.beginPath();
      context.arc(cluster.x, cluster.y, radius, 0, Math.PI * 2);
      context.fillStyle = model.mode === 'after' ? palette.accent : palette.muted;
      context.fill();
      if (cluster.ids.includes(model.selected)) {
        context.lineWidth = 3;
        context.strokeStyle = palette.text;
        context.stroke();
      }
      if (cluster.ids.length > 1) {
        context.fillStyle = palette.panel;
        context.font = '600 11px system-ui';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(cluster.ids.length), cluster.x, cluster.y);
      }
    }
    const selected = current.find((p) => p.id === model.selected);
    if (selected) {
      const p = point(selected);
      context.beginPath();
      context.arc(p.x, p.y, 9, 0, Math.PI * 2);
      context.lineWidth = 2;
      context.strokeStyle = palette.text;
      context.stroke();
    }
    canvas.dataset.points = String(current.length);
    canvas.dataset.clusters = String(clusters.length);
    canvas.dataset.mode = model.mode;
    document.getElementById('photo-map-status').textContent =
      `${model.mode === 'before' ? 'До' : 'После'}: ${current.length} точек · Без GEO: ${rows.filter((r) => !r[model.mode]).length}`;
  }
  const local = (event) => {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };
  function zoom(factor) {
    if (!model.view) return;
    model.view.scale = Math.max(0.1, Math.min(1e7, model.view.scale * factor));
    schedule();
  }
  panel.querySelectorAll('[data-map-action]').forEach(
    (button) =>
      (button.onclick = () => {
        const action = button.dataset.mapAction;
        if (action === 'before' || action === 'after') {
          model.mode = action;
          fit();
          for (const b of panel.querySelectorAll('[aria-pressed]'))
            b.setAttribute('aria-pressed', String(b.dataset.mapAction === action));
          selectPhoto(model.selected);
        } else if (action === 'fit') fit();
        else zoom(action === 'zoom-in' ? 2 : 0.5);
      })
  );
  canvas.onwheel = (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.25 : 0.8);
  };
  canvas.onkeydown = (event) => {
    if (['+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (['+', '=', '-'].includes(event.key)) zoom(event.key === '-' ? 0.5 : 2);
      else if (model.view) {
        const d = 40 / model.view.scale;
        model.view.center.longitude +=
          event.key === 'ArrowLeft' ? -d : event.key === 'ArrowRight' ? d : 0;
        model.view.center.latitude +=
          event.key === 'ArrowUp' ? d : event.key === 'ArrowDown' ? -d : 0;
        schedule();
      }
    }
  };
  canvas.onpointerdown = (event) => {
    if (event.button !== 0 || !model.view) return;
    const start = local(event),
      selected = points().find((p) => p.id === model.selected),
      position = selected ? project(selected, model.view, width, height) : null;
    const marker =
      model.mode === 'after' &&
      cityId &&
      !state.imagesBusy &&
      position &&
      Math.hypot(start.x - position.x, start.y - position.y) < 12;
    drag = {
      kind: marker ? 'marker' : 'pan',
      start,
      current: start,
      center: { ...model.view.center },
      moved: false
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
  };
  canvas.onpointermove = (event) => {
    if (!drag) return;
    drag.current = local(event);
    drag.moved ||= Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) > 4;
    if (drag.kind === 'pan' && drag.moved) {
      model.view.center = {
        longitude: drag.center.longitude - (drag.current.x - drag.start.x) / model.view.scale,
        latitude: drag.center.latitude + (drag.current.y - drag.start.y) / model.view.scale
      };
    }
    schedule();
  };
  canvas.onpointerup = async (event) => {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (finished.moved && finished.kind === 'marker') {
      try {
        await onMove?.(model.selected, unproject(local(event), model.view, width, height));
      } catch (error) {
        onError?.(error);
      }
    } else if (!finished.moved) {
      const p = local(event),
        hit = clusters.find((c) => Math.hypot(p.x - c.x, p.y - c.y) < (c.ids.length > 1 ? 18 : 12));
      if (hit?.ids.length === 1) selectPhoto(hit.ids[0]);
      else if (hit) {
        model.view = fitMap(hit.points, null, width, height);
        model.view.scale = Math.min(1e7, model.view.scale * 1.4);
        selectPhoto(hit.ids[0]);
      }
    }
    schedule();
  };
  canvas.onpointercancel = () => {
    drag = null;
    schedule();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(canvas);
  selectPhoto(model.selected);
  schedule();
  if (cityId && !geometry) {
    geometryRequest = crypto.randomUUID();
    window.blego
      .geoBoundary({ cityId, requestId: geometryRequest })
      .then((result) => {
        if (closed || cityId !== state.geoCity) return;
        boundaries.set(cityId, result);
        if (boundaries.size > 8) boundaries.delete(boundaries.keys().next().value);
        geometry = result.geometry;
        if (model.mode === 'after') fit();
        else schedule();
      })
      .catch((error) => {
        if (!closed && error.message !== 'CANCELLED') onError?.(error);
      });
  }
  dispose = () => {
    closed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
    if (geometryRequest) window.blego.cancelGeo(geometryRequest).catch(() => {});
  };
}
