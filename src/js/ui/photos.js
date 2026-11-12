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
      ? `<input class="input" name="gps-latitude" type="number" step="any" placeholder="Latitude −90…90" value=""><input class="input" name="gps-longitude" type="number" step="any" placeholder="Longitude −180…180" value=""><input class="input" name="gps-altitude" type="number" step="any" placeholder="Optional altitude" value="">`
      : field === 'captureDate'
        ? `<input class="input" name="date-local" type="datetime-local" step="1" value=""><input class="input" name="date-offset" placeholder="Offset, e.g. +03:00; leave unspecified if unknown" value="">`
        : field === 'personalIdentifiers'
          ? 'Removal only'
          : `<textarea class="input" name="value-${field}" rows="2" ${field === 'keywords' ? 'placeholder="One keyword per line"' : ''}></textarea>`;
  return `<tr><td>${esc(field)}</td><td>${esc(unique.length > 1 ? 'Different values' : metadataText(value) || '(empty)')}</td><td><select class="input" name="action-${field}">${state.imageEditTarget === 'group' ? '' : '<option value="inherit">Inherit group</option>'}<option value="keep">Keep</option>${field === 'personalIdentifiers' ? '' : '<option value="set">Set</option>'}<option value="remove">Remove</option></select></td><td>${input}</td></tr>`;
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
    else if (['iso', 'fNumber', 'focalLength'].includes(field))
      op.value = Number(data.get(`value-${field}`) || NaN);
    else if (field === 'exposureTime') {
      const value = String(data.get(`value-${field}`) || '');
      op.value = value.includes('/') ? value : Number(value || NaN);
    } else op.value = data.get(`value-${field}`) || '';
    op.origin = state.metadataOrigins?.[field] || { kind: 'manual' };
    return op;
  });
}
export function photosHTML() {
  const selected = state.photos.filter((photo) => photo.selected && photo.view);
  const plan = state.metadataPlan;
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">ASSETS</div><h1>Images / Metadata</h1><p class="sub">Read metadata, preview changes and export copies. Original files and image content remain unchanged. Metadata entries do not prove authorship or camera provenance.</p></div><div class="head-actions"><button class="btn" data-action="images-choose" ${state.imagesBusy ? 'disabled' : ''}>Add images</button><button class="btn btn-quiet" data-action="photos-clear" ${state.imagesBusy ? 'disabled' : ''}>Clear list</button></div></div>
 <p class="sub">${state.photos.length}/100 files · up to 50 MiB each, 512 MiB total and 40 megapixels. Static JPEG, PNG and WebP. Processing stays local. Copy image transfers pixels only; use Export verified copies for a file with edited metadata.</p>
 ${groupControls()}
 ${state.photos.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Select</th><th>File</th><th>State</th><th>Preview</th></tr></thead><tbody>${state.photos.map((photo) => `<tr><td><input type="checkbox" data-image-select="${photo.fileId}" ${photo.selected ? 'checked' : ''} ${photo.view?.capabilities.writable ? '' : 'disabled'}></td><td>${esc(photo.name)} · ${(photo.size / 1048576).toFixed(2)} MiB</td><td>${esc(photo.status)} ${esc(photo.error || '')}${photo.view ? ` · ${photo.view.imageInfo.width}×${photo.view.imageInfo.height}<br>${esc(photo.view.warnings.join(', '))}` : ''}</td><td><button class="btn" data-action="image-preview" data-id="${photo.fileId}" ${photo.view ? '' : 'disabled'}>View image</button><button class="btn" data-action="image-copy" data-id="${photo.fileId}" ${photo.view && !state.imagesBusy ? '' : 'disabled'}>Copy image pixels</button><button class="btn btn-quiet" data-action="photo-remove" data-id="${photo.fileId}" ${state.imagesBusy ? 'disabled' : ''}>Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty"><h3>No images selected</h3><p>Use Add images to choose files for local editing.</p></div>'}
 ${state.imagePreview ? `<figure class="card pad"><img src="${state.imagePreview}" style="max-width:100%;max-height:340px;object-fit:contain" alt="Selected original image"><figcaption>Original visual preview; export will create a separate file.</figcaption></figure>` : ''}
 ${
   selected.length
     ? `<form id="metadata-form" class="card pad"><fieldset ${state.imagesBusy ? 'disabled' : ''} style="border:0;padding:0"><h3>${selected.length} selected files</h3><p class="sub">New fields inherit the group rule; group rules start at Keep. Empty Set values are rejected; choose Remove explicitly. Orientation and color profiles are protected.</p><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Current value</th><th>Action</th><th>New value</th></tr></thead><tbody>${METADATA_FIELDS.map(
         (field) =>
           editor(
             field,
             selected.map((photo) => photo.view.tags.find((tag) => tag.field === field)?.value)
           )
       ).join(
         ''
       )}</tbody></table></div><label class="fl"><input type="checkbox" name="confirm-maker"> I reviewed the MakerNotes warning for changes to camera make/model.</label><button type="button" class="btn" data-action="group-operations">Apply to ${state.imageEditTarget === 'group' ? 'group' : 'selected files'}</button><label class="fl">Export scope<select class="input" id="image-export-scope"><option value="selection">Selected files</option><option value="group">Current group</option><option value="all">All groups</option></select></label><button type="submit" class="btn btn-primary">Choose folders and preview changes</button><label class="fl">Preset<select class="input" id="metadata-preset">${(state.metadataPresets || []).map((preset) => `<option value="${esc(preset.id)}">${esc(preset.name)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="metadata-preset-plan">Preview preset</button><input class="input" id="metadata-preset-name" placeholder="Name for current changes"><button type="button" class="btn" data-action="metadata-preset-save">Save current changes as preset</button><button type="button" class="btn" data-action="metadata-preset-import">Import preset</button><button type="button" class="btn" data-action="preset-rename">Rename</button><button type="button" class="btn" data-action="preset-duplicate">Duplicate</button><button type="button" class="btn" data-action="preset-delete">Delete preset</button><button type="button" class="btn" data-action="preset-export">Export preset JSON</button><p class="sub">Saved presets and group rules may contain personal metadata. They stay in the local database; exported JSON includes those values. File overrides are session-only. Original paths and access permissions are never saved.</p></fieldset></form>`
     : ''
 }
 ${
   plan
     ? `<div class="card pad" data-metadata-plan><h3>Before / after</h3><p class="sub">Review each change. Personal-metadata removal does not anonymize pixels or unknown blocks. ${esc(plan.warnings.join(', '))}</p>${plan.files
         .map(
           (file) =>
             `<h4>${esc(file.groupName || '')} · ${esc(file.name)} → ${esc(file.destinationName || '')}</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Before</th><th>After</th><th>Operation</th></tr></thead><tbody>${file.beforeAfter
               .filter((row) => row.operation !== 'keep')
               .map(
                 (row) =>
                   `<tr><td>${esc(row.field)}</td><td>${esc(metadataText(row.before))}</td><td>${esc(metadataText(row.after))}</td><td>${esc(row.operation)}</td></tr>`
               )
               .join('')}</tbody></table></div>`
         )
         .join(
           ''
         )}<button class="btn" data-action="metadata-export" ${state.imagesBusy ? 'disabled' : ''}>Export verified copies</button></div>`
     : ''
 }
 ${state.imagesBusy ? `<button class="btn" data-action="metadata-cancel">${state.imagesReading ? 'Cancel reading' : 'Cancel export'}</button>${!state.imagesReading ? (state.imageWorkspace?.groups || []).map((g) => `<button class="btn" data-action="metadata-cancel-group" data-id="${g.id}">Cancel ${esc(g.name)}</button>`).join('') : ''}` : ''}
 ${
   state.imagesBusy || Object.keys(state.metadataProgress || {}).length
     ? `<div class="card pad" data-metadata-progress>${Object.values(state.metadataProgress || {})
         .map(
           (file) =>
             `<p data-progress-id="${file.fileId}">${esc(file.name)}: ${esc(file.status)} ${esc(file.error || '')} ${esc(file.outputName || '')}</p>`
         )
         .join('')}</div>`
     : ''
 }
 ${
   state.metadataExport
     ? `<div class="card pad"><p>Export finished. Only completed files passed read-back and pixel checks. Reports omit tag values and full paths.</p><button class="btn" data-action="metadata-report" data-format="json">Save JSON report</button><button class="btn" data-action="metadata-report" data-format="txt">Save text report</button>${state.metadataExport.files
         .filter((f) => ['failed', 'cancelled'].includes(f.status))
         .map(
           (f) =>
             `<label class="fl"><input type="checkbox" data-retry-file="${f.fileId}"> ${esc(f.name)} — ${esc(f.status)}</label>`
         )
         .join(
           ''
         )}<button class="btn" data-action="metadata-retry">Prepare selected failed/cancelled files again</button><details><summary>Export history (${state.imageExportHistory?.length || 0})</summary>${(state.imageExportHistory || []).map((r) => `<p>${esc(r.runId)}: ${r.files.map((f) => `${esc(f.name)} — ${esc(f.status)}`).join('; ')}</p>`).join('')}</details></div>`
     : ''
 }
 </div>`;
}

function groupControls() {
  const workspace = state.imageWorkspace;
  if (!workspace) return '';
  const groupId = state.imageGroupId || 'ungrouped';
  return `<div class="card pad"><h3>Image groups</h3><fieldset ${state.imagesBusy ? 'disabled' : ''} style="border:0;padding:0"><select class="input" id="image-group">${workspace.groups.map((g) => `<option value="${g.id}" ${g.id === groupId ? 'selected' : ''}>${esc(g.name)} (${Object.values(workspace.membership).filter((id) => id === g.id).length})</option>`).join('')}</select><input class="input" id="image-group-name" placeholder="Group name"><button class="btn" data-action="group-create">Create group</button><button class="btn" data-action="group-rename">Rename group</button><button class="btn" data-action="group-delete">Delete group</button><button class="btn" data-action="group-select">Select files in group</button><button class="btn" data-action="group-move">Move selected here</button><label class="fl">Edit rules for<select class="input" id="image-edit-target"><option value="selection" ${state.imageEditTarget !== 'group' ? 'selected' : ''}>Selected files (overrides)</option><option value="group" ${state.imageEditTarget === 'group' ? 'selected' : ''}>Current group</option></select></label><button class="btn" data-action="group-save">Save group settings locally</button><p class="sub">Edits stay in this session until you explicitly save. Files and per-file overrides must be selected again after restart.</p><button class="btn" data-action="reference-choose">Choose reference image</button>${
    state.imageReference
      ? `<h4>${esc(state.imageReference.name)}</h4><p class="sub">Select only fields to copy. Missing values are skipped. Author, GPS and dates are personal data.</p>${state.imageReference.tags
          .filter((t) => t.value != null)
          .map(
            (t) =>
              `<label class="fl"><input type="checkbox" data-reference-field="${t.field}"> ${esc(t.field)}: ${esc(metadataText(t.value))}</label>`
          )
          .join(
            ''
          )}<button class="btn" data-action="reference-use">Use selected reference fields</button>`
      : ''
  }</fieldset></div>`;
}
export function draftFromOperations(operations) {
  const draft = {};
  const origins = {};
  for (const op of operations) {
    draft['action-' + op.field] = op.action;
    if (op.origin) origins[op.field] = op.origin;
    if (op.action !== 'set') continue;
    if (op.field === 'gps')
      for (const k of ['latitude', 'longitude', 'altitude']) draft['gps-' + k] = op.value[k] ?? '';
    else if (op.field === 'captureDate') {
      draft['date-local'] = op.value.local;
      draft['date-offset'] = op.value.offset || '';
    } else draft['value-' + op.field] = Array.isArray(op.value) ? op.value.join('\n') : op.value;
  }
  return { draft, origins };
}
