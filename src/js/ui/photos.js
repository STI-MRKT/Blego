import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const LIMIT = 50;

const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function photosHTML() {
  const photos = state.photos;
  const total = photos.reduce((sum, photo) => sum + photo.size, 0);
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">ASSETS</div><h1>Photos</h1>
        <p class="sub">Upload up to ${LIMIT} images for the next processing step. Files stay in this session only and never leave the device.</p></div>
      <div class="head-actions">
        <button class="btn btn-quiet" data-action="photos-clear" ${photos.length ? '' : 'disabled'}>Clear all</button>
      </div>
    </div>
    <div class="photo-stats">
      <div><b>${photos.length}</b><span>of ${LIMIT} uploaded</span></div>
      <div><b>${sizeText(total)}</b><span>total size</span></div>
      <div class="photo-meter"><i style="width:${Math.min(100, (photos.length / LIMIT) * 100)}%"></i></div>
    </div>
    <label class="drop photo-drop ${photos.length ? 'compact' : ''}" id="photo-drop" for="photo-input">
      <div class="di">${I.image}</div>
      <h3>${photos.length ? 'Add more photos' : 'Drop photos here'}</h3>
      <p>or <span class="link">browse your computer</span></p>
      <div class="hint">PNG, JPG, WEBP · up to ${LIMIT} files</div>
      <input type="file" id="photo-input" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
    </label>
    ${photos.length ? `<div class="photo-grid">
      ${photos.map((photo) => `<figure class="ph">
        <img src="${photo.url}" alt="${esc(photo.name)}" loading="lazy">
        <button class="ph-del" data-action="photo-remove" data-id="${photo.id}" aria-label="Remove">${I.x}</button>
        <figcaption><b>${esc(photo.name)}</b><span>${sizeText(photo.size)}</span></figcaption>
      </figure>`).join('')}
    </div>` : `<div class="photo-placeholder"><span class="t">Processing</span><p>Cropping, background cleanup and export will be connected here next. Upload is ready now.</p></div>`}
  </div>`;
}

export const PHOTO_LIMIT = LIMIT;
