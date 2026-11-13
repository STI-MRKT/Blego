import { I } from '../icons.js';
import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { METADATA_FIELDS, IMAGE_LIMITS } from '../../../shared/metadata-contracts.mjs';
export function imageErrorMessage(code) {
  const messages = {
    CANCELLED: 'Операция отменена.',
    IMAGE_SCAN_LIMIT: 'Папка слишком сложная. Выберите вложенную папку.',
    IMAGE_QUEUE_LIMIT: 'Пакет превышает лимит 1000 файлов или 10 ГиБ. Выберите меньше фотографий.',
    IMAGE_METADATA_LIMIT: 'Метаданные пакета превышают лимит памяти. Разделите пакет.',
    IMAGE_UNSUPPORTED_LINK: 'Выберите исходную папку или файл вместо символической ссылки.',
    METADATA_UNSAFE_DESTINATION: 'Путь сохранения изменён или содержит ссылку. Выберите другую папку.',
    GEO_BOUNDARY_UNAVAILABLE:'Граница города недоступна. Выберите другой город или импортируйте каталог.',
    GEO_INVALID_CATALOG:'Не удалось проверить каталог городов. Проверьте формат и источник.',
    GEO_GENERATION_EXHAUSTED:'Не удалось выбрать точки внутри этой границы. Выберите другой город.',
    GEO_INVALID_GEOMETRY:'Граница города повреждена или неоднозначна.',
    GEO_DATELINE_UNSUPPORTED:'Границы через линию перемены дат пока не поддерживаются.',
    GEO_GEOMETRY_TOO_COMPLEX:'Эта граница превышает допустимую сложность.',
    EACCES: 'Permission denied. Choose a writable folder.',
    EPERM: 'Permission denied. Choose a writable folder.',
    ENOSPC: 'The destination is full. Free space or choose another folder.',
    METADATA_INVALID_DATE: 'Enter a valid date and an explicit offset when Set offset is selected.',
    METADATA_INVALID_DATE_SCOPE: 'Select EXIF, XMP or both date fields.',
    METADATA_CONFLICTING_DATE_OFFSETS:
      'Existing time zones conflict. Choose an explicit offset or remove it.',
    METADATA_INVALID_GPS: 'Enter latitude from −90 to 90 and longitude from −180 to 180.',
    METADATA_INVALID_VALUE: 'Enter a value, or choose Keep or Remove.',
    METADATA_INVALID_CAMERA_VALUE: 'Enter a valid positive camera value.',
    PLAN_STALE: 'The selection or files changed. Preview the changes again.',
    SOURCE_CHANGED: 'The original changed. Add it again before exporting.',
    MAKER_NOTES_CONFIRMATION_REQUIRED:
      'Review the camera warning in More metadata before continuing.',
    METADATA_ENGINE_UNAVAILABLE: 'The metadata engine is unavailable.',
    INVALID_DESTINATION: 'Choose a writable destination folder.',
    INVALID_RETRY: 'Select failed or cancelled files to retry.'
  };
  return (
    messages[code] ||
    (String(code || '').includes('VERIFY')
      ? 'The copy could not be verified. Nothing was saved.'
      : 'Could not complete this operation. Check the files and destination.')
  );
}
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
  return `<tr><td>${esc(field)}</td><td>${esc(unique.length > 1 ? 'Different values' : metadataText(value) || '(empty)')}${unique.length === 1 && value != null ? `<button type="button" class="copy tiny always" data-action="copy" data-copy="${esc(metadataText(value))}" aria-label="Copy current ${field}">${I.copy}</button>` : ''}</td><td><select class="input" name="action-${field}">${state.imageEditTarget === 'group' ? '' : `${state.photos.filter((p) => p.selected).length > 1 ? '<option value="unchanged">Leave overrides unchanged</option>' : ''}<option value="inherit">Inherit group</option>`}<option value="keep">Keep</option>${field === 'personalIdentifiers' ? '' : '<option value="set">Set</option>'}<option value="remove">Remove</option></select></td><td>${input}${field !== 'personalIdentifiers' ? inputCopy('value-' + field, field) : ''}</td></tr>`;
}
export function readMetadataForm(form) {
  return readMetadataData(new FormData(form), state.metadataOrigins);
}
export function readMetadataData(data, origins = {}) {
  return METADATA_FIELDS.map((field) => {
    const action = data.get(`action-${field}`) || 'keep';
    const op = { field, action };
    if (field === 'captureDate' && ['set', 'remove'].includes(action))
      op.scope = ['exif', 'xmp'].filter((k) => data.has('date-scope-' + k) && data.get('date-scope-' + k) !== false);
    if (action !== 'set') return op;
    if (field === 'gps')
      op.value = {
        latitude: Number(data.get('gps-latitude') || NaN),
        longitude: Number(data.get('gps-longitude') || NaN),
        altitudeMode: data.get('gps-altitude-mode') || 'keep',
        altitude:
          data.get('gps-altitude-mode') !== 'set' || data.get('gps-altitude') == null || data.get('gps-altitude') === ''
            ? null
            : Number(data.get('gps-altitude'))
      };
    else if (field === 'captureDate')
      op.value = {
        local:
          String(data.get('date-local')).length === 16
            ? `${data.get('date-local')}:00`
            : data.get('date-local'),
        offsetMode: data.get('date-offset-mode') || 'keep',
        offset: data.get('date-offset-mode') === 'set' ? data.get('date-offset') || null : null
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
    op.origin = origins?.[field] || { kind: 'manual' };
    return op;
  }).filter((op) => op.action !== 'unchanged');
}
function openDetails(id) {
  return state.imageDisclosures?.[id] ? 'open' : '';
}
function actionOptions() {
  return `${state.imageEditTarget === 'group' ? '' : `${state.photos.filter((p) => p.selected).length > 1 ? '<option value="unchanged">Keep individual choices</option>' : ''}<option value="inherit">Use group / keep</option>`}<option value="keep">Keep</option><option value="set">Set</option><option value="remove">Remove</option>`;
}
function copyValue(label, value) {
  return value == null
    ? ''
    : `<span style="display:inline-flex;align-items:center">${esc(value)}<button type="button" class="copy tiny always" data-action="copy" data-copy="${esc(value)}" aria-label="Copy ${label}">${I.copy}</button></span>`;
}
function inputCopy(name, label) {
  return `<button type="button" class="copy tiny always" data-action="metadata-copy-input" data-name="${name}" aria-label="Copy new ${label}">${I.copy}</button>`;
}
function quickEditor(field, selected) {
  const values = selected.map((p) => p.view.tags.find((t) => t.field === field)?.value),
    different = new Set(values.map((v) => JSON.stringify(v))).size > 1,
    v = different ? null : values[0];
  const current = different
    ? 'Different values'
    : field === 'gps' && v
      ? `${copyValue('latitude', v.latitude)}, ${copyValue('longitude', v.longitude)}${v.altitude != null ? ` · ${copyValue('altitude', v.altitude)}` : ''}`
      : field === 'captureDate' && v
        ? `${copyValue('date', v.local)} ${copyValue('time zone', v.offset)}`
        : 'No value';
  return `<section class="card pad"><h3>${field === 'gps' ? 'GEO / GPS' : 'Date taken'}</h3>${field==='gps'?geoControls():''}<p class="sub">Current: ${current}</p><label class="fl">${field === 'gps' ? 'Location' : 'EXIF / XMP date'}<select class="input" name="action-${field}">${actionOptions()}</select></label>
 <div data-field-inputs="${field}" hidden>${field === 'gps' ? `<details id="gps-manual" ${openDetails('gps-manual')}><summary>Точные координаты и высота</summary><label class="fl">Latitude<div class="cell-box"><input class="input" name="gps-latitude" type="number" step="any" min="-90" max="90" placeholder="−90…90">${inputCopy('gps-latitude', 'latitude')}</div></label><label class="fl">Longitude<div class="cell-box"><input class="input" name="gps-longitude" type="number" step="any" min="-180" max="180" placeholder="−180…180">${inputCopy('gps-longitude', 'longitude')}</div></label><label class="fl">Высота<select class="input" name="gps-altitude-mode"><option value="keep">Сохранить исходную</option><option value="set">Указать</option><option value="remove">Удалить</option></select></label><label class="fl">Altitude (optional)<div class="cell-box"><input class="input" name="gps-altitude" type="number" step="any" placeholder="Metres">${inputCopy('gps-altitude', 'altitude')}</div></label></details>` : `<label class="fl">Date and time<div class="cell-box"><input class="input" name="date-local" type="datetime-local" step="1">${inputCopy('date-local', 'date')}</div></label>`}</div>
 ${field === 'captureDate' ? `<label class="fl">Time zone<select class="input" name="date-offset-mode"><option value="keep">Keep existing for each image</option><option value="set">Set offset</option><option value="remove">Remove offset</option></select></label><div data-offset-input hidden><label class="fl">UTC offset<div class="cell-box"><input class="input" name="date-offset" placeholder="+03:00 or −05:00">${inputCopy('date-offset', 'time zone')}</div></label></div><details id="date-options" ${openDetails('date-options')}><summary>Date fields</summary><label class="fl"><input type="checkbox" name="date-scope-exif" checked> EXIF date taken</label><label class="fl"><input type="checkbox" name="date-scope-xmp" checked> XMP date taken</label><p class="sub">Other dates stay unchanged.</p></details>` : ''}</section>`;
}

function geoControls(){
 const catalogue=state.geoCatalogue||{countries:[],cities:[]};
 const cities=catalogue.cities.filter(c=>c.country===state.geoCountry&&(!state.geoQuery||`${c.name} ${c.region}`.toLowerCase().includes(state.geoQuery.toLowerCase())));
 return `<label class="fl">Страна<input class="input" id="geo-country" list="geo-countries" placeholder="Код или название страны" value="${esc(state.geoCountry||'')}"><datalist id="geo-countries">${catalogue.countries.map(c=>`<option value="${c.code}">${esc(c.name)}</option>`).join('')}</datalist></label><label class="fl">Поиск города<input class="input" id="geo-city-query" placeholder="Название или регион" value="${esc(state.geoQuery||'')}"></label><label class="fl">Город<select class="input" id="geo-city"><option value="">Выберите город</option>${cities.map(c=>`<option value="${esc(c.id)}" ${state.geoCity===c.id?'selected':''}>${esc(c.name)} — ${esc(c.region)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="geo-generate" ${!state.geoCity?'disabled':''}>Генерировать GEO для всех выбранных</button><p class="sub">Случайные точки внутри выбранной границы, не место съёмки. Высота сохраняется.</p><details ${state.geoImportPreview?'open':''}><summary>Каталог городов</summary><p class="sub">© OpenStreetMap contributors · ODbL-1.0. Доступны города локального каталога; City of London — только Сити.</p><button type="button" class="btn" data-action="geo-import">Импортировать каталог</button>${state.geoImportPreview?`<p>Добавить: ${state.geoImportPreview.added}. Уже есть: ${state.geoImportPreview.duplicates}.</p><p>${state.geoImportPreview.cities.map(c=>esc(c.name+' — '+c.country+' — '+c.source+' ('+c.license+')')).join('; ')}</p><button type="button" class="btn" data-action="geo-import-confirm">Подтвердить импорт</button>`:''}</details>`;
}
function geoFileHTML(photo){
 const op=state.imageWorkspace?.overrides[photo.fileId]?.find(o=>o.field==='gps'&&o.action==='set'&&o.origin?.kind==='geo');
 if(!op)return '';
 const city=state.geoCatalogue?.cities.find(c=>c.id.replace(/:/g,'_')===op.origin.id);
 return `<p class="sub" data-geo-file="${esc(photo.fileId)}">Сгенерировано · ${esc(op.origin.name)} · ${esc(city?.source||'Локальный каталог')}${city?.userSupplied?' (источник пользователя)':''}<br>${copyValue('latitude',op.value.latitude)}, ${copyValue('longitude',op.value.longitude)}</p><button type="button" class="btn btn-quiet" data-action="geo-regenerate-one" data-id="${esc(photo.fileId)}" ${state.imagesBusy?'disabled':''}>Повторить GEO</button>`;
}

export function photosHTML() {
  const selected = state.photos.filter((p) => p.selected && p.view),
    plan = state.metadataPlan;
  const pageCount=Math.max(1,Math.ceil(state.photos.length/100)), page=Math.min(state.photoPage||0,pageCount-1), pagePhotos=state.photos.slice(page*100,(page+1)*100);
  const pager=pageCount>1?`<div class="head-actions"><button class="btn" data-action="photo-page" data-page="${page-1}" ${page===0?'disabled':''}>Назад</button><span>${page+1} / ${pageCount}</span><button class="btn" data-action="photo-page" data-page="${page+1}" ${page+1>=pageCount?'disabled':''}>Далее</button></div>`:'';
  return `<div class="page" id="photo-drop"><input type="file" id="photo-input" accept=".jpg,.jpeg,.png,.webp" multiple hidden><div class="page-head"><div><div class="eyebrow">ASSETS</div><h1>Photos</h1><p class="sub">Edit date or location, preview changes and save copies.</p></div><div class="head-actions"><button class="btn" data-action="images-choose" ${state.imagesBusy ? 'disabled' : ''}>Add photos</button><button class="btn" data-action="images-folder" ${state.imagesBusy ? 'disabled' : ''}>Добавить папку</button><button class="btn btn-quiet" data-action="photos-clear" ${!state.photos.length || state.imagesBusy ? 'disabled' : ''}>Clear all</button></div></div>
 <div class="photo-stats"><div><b>${state.photos.length}</b><span>photos</span></div><div><b>${selected.length}</b><span>selected</span></div><div class="photo-meter"><i style="width:${Math.min(100, state.photos.length)}%"></i></div></div>
 <p class="sub" id="image-scan-status" role="status">${state.imageScan ? `Найдено: ${state.imageScan.found} · Пропущено: ${state.imageScan.skipped} · Повторов: ${state.imageScan.duplicates}` : state.imagesReading ? 'Поиск и чтение фотографий…' : ''}</p>
 ${state.imageScan?.errors?.length ? `<details><summary>Не удалось прочитать: ${state.imageScan.errors.length}</summary>${state.imageScan.errors.map(e=>`<p>${esc(e.name)} — ${esc(imageErrorMessage(e.code))}</p>`).join('')}</details>`:''}
 ${pager}
 ${state.photos.length ? `<div class="photo-grid">${pagePhotos.map((p) => `<figure class="ph"><button class="btn-quiet" data-action="image-preview" data-id="${p.fileId}" style="display:block;width:100%;padding:0;border:0" aria-label="View ${esc(p.name)}" ${p.view ? '' : 'disabled'}>${p.thumbnail ? `<img src="${p.thumbnail}" alt="${esc(p.name)}" loading="lazy">` : `<div class="photo-placeholder">${p.status === 'reading' ? 'Reading…' : 'Preview unavailable'}</div>`}</button><button class="ph-del" data-action="photo-remove" data-id="${p.fileId}" aria-label="Remove ${esc(p.name)}" ${state.imagesBusy ? 'disabled' : ''}>${I.x}</button><figcaption><label><input type="checkbox" data-image-select="${p.fileId}" ${p.selected ? 'checked' : ''} ${p.view?.capabilities.writable && !state.imagesBusy ? '' : 'disabled'}><b>${esc(p.name)}</b></label></figcaption><p class="sub photo-source" title="${esc(p.relativePath||p.name)}">${esc(p.relativePath||p.name)}</p><p class="sub">${esc(p.view?.detectedFormat||'')} · ${(p.size/1048576).toFixed(2)} MiB · ${esc(p.status)}<br>${p.view?.tags?.find(t=>t.field==='gps')?.value ? `GPS: ${esc(metadataText(p.view.tags.find(t=>t.field==='gps').value))}`:'Без GEO'}</p><div class="news-actions"><button class="news-copy" data-action="copy" data-copy="${esc(p.name)}" aria-label="Copy filename">${I.copy}Name</button><button class="news-copy" data-action="image-copy" data-id="${p.fileId}" ${p.view && !state.imagesBusy ? '' : 'disabled'}>${I.copy}Image</button></div>${geoFileHTML(p)}${p.status === 'failed' || p.status === 'cancelled' ? `<p class="sub">${p.status === 'cancelled' ? 'Cancelled' : 'Could not read this image.'}</p>` : ''}</figure>`).join('')}</div>` : `<button class="drop photo-drop" style="width:100%" data-action="images-browse"><div class="di">${I.image}</div><h3>Add photos</h3><p>Choose JPEG, PNG or WebP images</p></button>`}
 ${state.imagePreview ? `<figure class="card pad"><img src="${state.imagePreview}" style="max-width:100%;max-height:340px;object-fit:contain" alt="Original image"><figcaption>${esc(state.imagePreviewName || 'Original image')}</figcaption><button class="btn btn-quiet" data-action="image-preview-close">Close preview</button></figure>` : ''}
 ${
   selected.length
     ? `<form id="metadata-form"><fieldset ${state.imagesBusy ? 'disabled' : ''} style="border:0;padding:0"><div class="net-grid2">${quickEditor('captureDate', selected)}${quickEditor('gps', selected)}</div><button type="submit" class="btn btn-primary">Preview changes</button>
 <details id="metadata-advanced" ${openDetails('metadata-advanced')}><summary>More metadata and presets</summary><div class="card pad"><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Current value</th><th>Action</th><th>New value</th></tr></thead><tbody>${METADATA_FIELDS.filter(
   (f) => !['captureDate', 'gps'].includes(f)
 )
   .map((field) =>
     editor(
       field,
       selected.map((p) => p.view.tags.find((t) => t.field === field)?.value)
     )
   )
   .join(
     ''
   )}</tbody></table></div><label class="fl"><input type="checkbox" name="confirm-maker"> I reviewed the MakerNotes warning for changes to camera make/model.</label><button type="button" class="btn" data-action="group-operations">Apply to ${state.imageEditTarget === 'group' ? 'group' : 'selected files'}</button><label class="fl">Export scope<select class="input" id="image-export-scope"><option value="selection">Selected files</option><option value="group">Current group</option><option value="all">All groups</option></select></label>
 <label class="fl">Preset<select class="input" id="metadata-preset">${(state.metadataPresets || []).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="metadata-preset-plan">Preview preset</button><input class="input" id="metadata-preset-name" placeholder="Name for current changes">${[
   ['metadata-preset-save', 'Save current changes as preset'],
   ['metadata-preset-import', 'Import preset'],
   ['preset-rename', 'Rename'],
   ['preset-duplicate', 'Duplicate'],
   ['preset-delete', 'Delete preset'],
   ['preset-export', 'Export preset JSON']
 ]
   .map(
     ([action, label]) =>
       `<button type="button" class="btn" data-action="${action}">${label}</button>`
   )
   .join('')}
 <p class="sub">Originals are kept. Orientation and colour profiles stay unchanged. Saved groups and presets may contain personal metadata. File selection and per-file overrides are session-only.</p></div></details></fieldset></form>`
     : ''
 }
 ${
   plan
     ? `<div class="card pad" data-metadata-plan><h3>Before / after</h3>${plan.files
         .map(
           (file) =>
             `<h4>${esc(file.name)}</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${file.beforeAfter
               .filter((row) => row.operation !== 'keep')
               .map(
                 (row) =>
                   `<tr><td>${esc(row.field === 'captureDate' ? 'Date taken' : row.field)} ${esc(row.representation || '')}</td><td>${copyValue('previous value', metadataText(row.before))}</td><td>${copyValue('new value', metadataText(row.after))}</td></tr>`
               )
               .join('')}</tbody></table></div>`
         )
         .join(
           ''
         )}<button class="btn btn-primary" data-action="metadata-export" ${state.imagesBusy ? 'disabled' : ''}>Save copies</button><details><summary>Details and warnings</summary><p>${esc(plan.warnings.join(', ') || 'No warnings')}</p><p>Personal-metadata removal does not anonymize pixels or unknown blocks.</p>${plan.files.map((file) => `<p>${esc(file.groupName || '')} · ${esc(file.destinationName || '')}</p>`).join('')}</details></div>`
     : ''
 }
 ${state.imagesBusy ? `<button class="btn" data-action="metadata-cancel">${state.geoBusy ? 'Отменить генерацию GEO' : state.imagesReading ? 'Cancel reading' : 'Cancel export'}</button>${!state.imagesReading ? (state.imageWorkspace?.groups || []).map((g) => `<button class="btn" data-action="metadata-cancel-group" data-id="${g.id}">Cancel ${esc(g.name)}</button>`).join('') : ''}` : ''}
 ${
   state.imagesBusy || Object.keys(state.metadataProgress || {}).length
     ? `<div class="card pad" data-metadata-progress>${Object.values(state.metadataProgress || {})
         .map(
           (file) =>
             `<p data-progress-id="${file.fileId}">${esc(file.name)}: ${esc(file.status)} ${file.error ? esc(imageErrorMessage(file.error)) : ''} ${file.outputName ? copyValue('output filename', file.outputName) : ''}</p>`
         )
         .join('')}</div>`
     : ''
 }
 ${
   state.metadataExport
     ? `<div class="card pad"><p>${state.metadataExport.files.filter((f) => f.status === 'completed').length ? `Saved ${state.metadataExport.files.filter((f) => f.status === 'completed').length} copies.` : 'No copies saved.'}</p>${state.metadataExport.files
         .filter((f) => ['failed', 'cancelled'].includes(f.status))
         .map(
           (f) =>
             `<label class="fl"><input type="checkbox" data-retry-file="${f.fileId}">${esc(f.name)} — ${esc(f.status)}</label>`
         )
         .join(
           ''
         )}<button class="btn" data-action="metadata-retry">Retry selected files</button><details><summary>Reports and export history</summary><button class="btn" data-action="metadata-report" data-format="json">Save JSON report</button><button class="btn" data-action="metadata-report" data-format="txt">Save text report</button>${(state.imageExportHistory || []).map((r) => `<p>${r.files.map((f) => `${esc(f.name)} — ${esc(f.status)}`).join('; ')}</p>`).join('')}</details></div>`
     : ''
 }
 <details id="image-groups-advanced" ${openDetails('image-groups-advanced')}><summary>Groups and reference image</summary>${groupControls()}</details>
 <details><summary>File details</summary><p class="sub">Up to 1000 images, 50 MiB each, 10 GiB queued and 40 megapixels per image. Retained metadata is limited to 64 MiB; two files are processed concurrently. Static JPEG, PNG and WebP. Metadata does not prove authorship or camera provenance.</p>${pagePhotos.map((p) => `<p>${esc(p.name)} · ${(p.size / 1048576).toFixed(2)} MiB · ${esc(p.status)} ${esc(p.error || '')} ${esc(p.view?.warnings?.join(', ') || '')}</p>`).join('')}</details></div>`;
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
              `<label class="fl"><input type="checkbox" data-reference-field="${t.field}" ${t.referenceSupported === false ? 'disabled' : ''}> ${esc(t.field)}: ${esc(metadataText(t.value))}${t.referenceSupported === false ? ' (not supported as a reference value)' : ''}</label>`
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
    if (op.field === 'captureDate' && op.scope) {
      for (const k of ['exif', 'xmp']) draft['date-scope-' + k] = op.scope.includes(k);
    }
    if (op.action !== 'set') continue;
    if (op.field === 'gps') {
      draft['gps-altitude-mode']=op.value.altitudeMode || (op.value.altitude==null?'remove':'set');
      for (const k of ['latitude', 'longitude', 'altitude']) draft['gps-' + k] = op.value[k] ?? '';
    } else if (op.field === 'captureDate') {
      draft['date-local'] = op.value.local;
      draft['date-offset'] = op.value.offset || '';
      draft['date-offset-mode'] = op.value.offsetMode || (op.value.offset ? 'set' : 'remove');
    } else draft['value-' + op.field] = Array.isArray(op.value) ? op.value.join('\n') : op.value;
  }
  return { draft, origins };
}
