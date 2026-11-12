import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { METADATA_FIELDS, IMAGE_LIMITS } from '../../../shared/metadata-contracts.mjs';
export const PHOTO_LIMIT = IMAGE_LIMITS.files;
export function metadataText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if ('latitude' in value)
      return `${value.latitude}, ${value.longitude}${value.altitude == null ? '' : ` · altitude ${value.altitude}`}`;
    if ('local' in value) return `${value.local}${value.offset || ' (timezone unspecified)'}`;
    return Object.values(value).join(', ');
  }
  return String(value);
}
function editor(field, values) {
  const unique = [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
  const value = unique.length === 1 ? unique[0] : null;
  const input =
    field === 'gps'
      ? `<input class="input" name="gps-latitude" type="number" step="any" placeholder="Latitude −90…90" value="${value?.latitude ?? ''}"><input class="input" name="gps-longitude" type="number" step="any" placeholder="Longitude −180…180" value="${value?.longitude ?? ''}"><input class="input" name="gps-altitude" type="number" step="any" placeholder="Optional altitude" value="${value?.altitude ?? ''}">`
      : field === 'captureDate'
        ? `<input class="input" name="date-local" type="datetime-local" step="1" value="${esc(value?.local || '')}"><input class="input" name="date-offset" placeholder="Offset, e.g. +03:00; leave unspecified if unknown" value="${esc(value?.offset || '')}">`
        : field === 'personalIdentifiers'
          ? 'Removal only'
          : `<textarea class="input" name="value-${field}" rows="2" ${field === 'keywords' ? 'placeholder="One keyword per line"' : ''}>${esc(field === 'keywords' && Array.isArray(value) ? value.join('\n') : metadataText(value))}</textarea>`;
  return `<tr><td>${esc(field)}</td><td>${esc(unique.length > 1 ? 'Different values' : metadataText(value) || '(empty)')}</td><td><select class="input" name="action-${field}"><option value="keep">Keep</option>${field === 'personalIdentifiers' ? '' : '<option value="set">Set</option>'}<option value="remove">Remove</option></select></td><td>${input}</td></tr>`;
}
export function readMetadataForm(form) {
  const data = new FormData(form);
  return METADATA_FIELDS.map((field) => {
    const action = data.get(`action-${field}`) || 'keep';
    const op = { field, action };
    if (action !== 'set') return op;
    if (field === 'gps')
      op.value = {
        latitude: Number(data.get('gps-latitude') || NaN),
        longitude: Number(data.get('gps-longitude') || NaN),
        altitude: data.get('gps-altitude') === '' ? null : Number(data.get('gps-altitude'))
      };
    else if (field === 'captureDate')
      op.value = {
        local:
          String(data.get('date-local')).length === 16
            ? `${data.get('date-local')}:00`
            : data.get('date-local'),
        offset: data.get('date-offset') || null
      };
    else if (field === 'keywords')
      op.value = String(data.get(`value-${field}`) || '')
        .split(/\r?\n/)
        .filter((value) => value.length);
    else op.value = data.get(`value-${field}`) || '';
    return op;
  });
}
export function photosHTML() {
  const selected = state.photos.filter((photo) => photo.selected && photo.view);
  const plan = state.metadataPlan;
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">ASSETS</div><h1>Images / Metadata</h1><p class="sub">Read metadata, preview changes and export copies. Original files and image content remain unchanged. Metadata entries do not prove authorship or camera provenance.</p></div><div class="head-actions"><button class="btn" data-action="images-choose" ${state.imagesBusy ? 'disabled' : ''}>Add images</button><button class="btn btn-quiet" data-action="photos-clear" ${state.imagesBusy ? 'disabled' : ''}>Clear list</button></div></div>
 <p class="sub">${state.photos.length}/100 files · up to 50 MiB each, 512 MiB total and 40 megapixels. Static JPEG, PNG and WebP. Processing stays local. Copy image transfers pixels only; use Export verified copies for a file with edited metadata.</p>
 ${state.photos.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Select</th><th>File</th><th>State</th><th>Preview</th></tr></thead><tbody>${state.photos.map((photo) => `<tr><td><input type="checkbox" data-image-select="${photo.fileId}" ${photo.selected ? 'checked' : ''} ${photo.view?.capabilities.writable ? '' : 'disabled'}></td><td>${esc(photo.name)} · ${(photo.size / 1048576).toFixed(2)} MiB</td><td>${esc(photo.status)} ${esc(photo.error || '')}${photo.view ? ` · ${photo.view.imageInfo.width}×${photo.view.imageInfo.height}<br>${esc(photo.view.warnings.join(', '))}` : ''}</td><td><button class="btn" data-action="image-preview" data-id="${photo.fileId}" ${photo.view ? '' : 'disabled'}>View image</button><button class="btn" data-action="image-copy" data-id="${photo.fileId}" ${photo.view && !state.imagesBusy ? '' : 'disabled'}>Copy image pixels</button><button class="btn btn-quiet" data-action="photo-remove" data-id="${photo.fileId}" ${state.imagesBusy ? 'disabled' : ''}>Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty"><h3>No images selected</h3><p>Use Add images to choose files for local editing.</p></div>'}
 ${state.imagePreview ? `<figure class="card pad"><img src="${state.imagePreview}" style="max-width:100%;max-height:340px;object-fit:contain" alt="Selected original image"><figcaption>Original visual preview; export will create a separate file.</figcaption></figure>` : ''}
 ${
   selected.length
     ? `<form id="metadata-form" class="card pad"><fieldset ${state.imagesBusy ? 'disabled' : ''} style="border:0;padding:0"><h3>${selected.length} selected files</h3><p class="sub">Every field starts at Keep. Empty Set values are rejected; choose Remove explicitly. Orientation and color profiles are protected.</p><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Current value</th><th>Action</th><th>New value</th></tr></thead><tbody>${METADATA_FIELDS.map(
         (field) =>
           editor(
             field,
             selected.map((photo) => photo.view.tags.find((tag) => tag.field === field)?.value)
           )
       ).join(
         ''
       )}</tbody></table></div><label class="fl"><input type="checkbox" name="confirm-maker"> I reviewed the MakerNotes warning for changes to camera make/model.</label><button type="submit" class="btn btn-primary">Preview changes</button><label class="fl">Preset<select class="input" id="metadata-preset">${(state.metadataPresets || []).map((preset) => `<option value="${esc(preset.id)}">${esc(preset.name)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="metadata-preset-plan">Preview preset</button><input class="input" id="metadata-preset-name" placeholder="Name for current changes"><button type="button" class="btn" data-action="metadata-preset-save">Save current changes as preset</button><button type="button" class="btn" data-action="metadata-preset-import">Import preset</button></fieldset></form>`
     : ''
 }
 ${plan ? `<div class="card pad" data-metadata-plan><h3>Before / after</h3><p class="sub">Review each change. Personal-metadata removal does not anonymize pixels or unknown blocks. ${esc(plan.warnings.join(', '))}</p>${plan.files.map((file) => `<h4>${esc(file.name)}</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Before</th><th>After</th><th>Operation</th></tr></thead><tbody>${file.beforeAfter.map((row) => `<tr><td>${esc(row.field)}</td><td>${esc(metadataText(row.before))}</td><td>${esc(metadataText(row.after))}</td><td>${esc(row.operation)}</td></tr>`).join('')}</tbody></table></div>`).join('')}<button class="btn" data-action="metadata-export" ${state.imagesBusy ? 'disabled' : ''}>Export verified copies</button></div>` : ''}
 ${state.imagesBusy ? `<button class="btn" data-action="metadata-cancel">${state.imagesReading ? 'Cancel reading' : 'Cancel export'}</button>` : ''}
 ${
   Object.keys(state.metadataProgress || {}).length
     ? `<div class="card pad" data-metadata-progress>${Object.values(state.metadataProgress)
         .map(
           (file) =>
             `<p>${esc(file.name)}: ${esc(file.status)} ${esc(file.error || '')} ${esc(file.outputName || '')}</p>`
         )
         .join('')}</div>`
     : ''
 }
 ${state.metadataExport ? '<div class="card pad"><p>Export finished. Only files marked completed passed read-back and image checks. Originals were not edited. Reports omit tag values and full paths.</p><button class="btn" data-action="metadata-report" data-format="json">Save JSON report</button><button class="btn" data-action="metadata-report" data-format="txt">Save text report</button></div>' : ''}
 </div>`;
}
