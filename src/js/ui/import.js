import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { I } from '../icons.js';
import { CLASSIFIER_FIELDS } from '../../../shared/classifier.mjs';
export const isCookieColumn = name => /^(?:cookies?(?:_?json)?|куки)$/i.test(String(name || '').trim().replace(/[\s-]/g, '_'));
function cellHTML(record, field) {
  const raw = record.data[field.key] || '';
  const long = ['userAgent','token','cookies'].includes(field.key);
  const shown = long && raw.length > 12 ? raw.slice(0,12) + '…' : raw;
  if (field.key === 'rowNumber') return `<td class="num">${esc(raw)}<button class="copy" data-action="classifier-copy-row" data-row="${esc(record.id)}" aria-label="Копировать строку">${I.copy}</button></td>`;
  return `<td><span class="classifier-value${long ? ' mono' : ''}">${esc(shown)}</span><button class="copy" data-action="${field.key === 'cookies' ? 'import-cookie-copy' : 'classifier-copy-cell'}" data-row="${esc(record.id)}" data-field="${field.key}" aria-label="Копировать ${field.key === 'cookies' ? 'cookie целиком' : esc(field.label)}" ${!raw ? 'disabled' : ''}>${I.copy}</button></td>`;
}
function optionsHTML(p) {
  const opts = state.classifierOptions || {};
  return `<div class="head-actions"><label class="fl">Заголовки<select class="input" id="classifier-headers">${[['','Авто'],['yes','Есть'],['no','Нет']].map(([v,label])=>`<option value="${v}" ${opts.headers===v?'selected':''}>${label}</option>`).join('')}</select></label>
  <label class="fl">Порядок колонок<select class="input" id="classifier-schema">${[['','Определить поля'],['core7','Основные 7 полей'],['full10','Все 10 полей без №'],['numbered11','Все 11 полей с №']].map(([v,label])=>`<option value="${v}" ${opts.schema===v?'selected':''}>${label}</option>`).join('')}</select></label>
  <label class="fl">Кодировка<select class="input" id="import-encoding">${[['','Авто / UTF-8'],['utf-8','UTF-8'],['utf-16le','UTF-16LE'],['utf-16be','UTF-16BE'],['windows-1251','Windows-1251']].map(([v,label])=>`<option value="${v}" ${state.importEncoding===v?'selected':''}>${label}</option>`).join('')}</select></label></div>
  ${p ? `<p class="sub">Уточните поля, которые не удалось определить.</p><div class="head-actions">${p.sourceColumns.map(c=>`<label class="fl">${esc(c)}<select class="input" data-classifier-map="${esc(c)}"><option value="">Авто</option>${CLASSIFIER_FIELDS.slice(1).map(f=>`<option value="${f.key}" ${opts.mapping?.[c]===f.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label>`).join('')}</div><button class="btn" data-action="classifier-apply">Применить соответствие</button>` : ''}`;
}
export function importHTML() {
  const p = state.importData;
  const busy = state.importStep === 'loading';
  const partial = p?.status === 'preview_partial';
  const confirmed = ['completed','partial_confirmed'].includes(p?.status);
  return `<div class="page classifier-page"><div class="page-head"><div><div class="eyebrow">Classification / Import</div><h1>${p ? 'Классификатор' : 'Data import'}</h1><p class="sub">${esc(state.importName || 'TXT · CSV · TSV · JSON — до 50 MiB')}</p></div><div class="head-actions">${state.importStep!=='idle'?'<button class="btn" data-action="import-reset">Discard / cancel</button>':''}${p&&!busy?'<button class="btn" data-action="classifier-copy-table">Копировать таблицу</button>':''}</div></div>
  ${state.importStep==='error'?`<div class="banner err">${esc(state.importError)}</div>`:''}
  ${busy?'<div class="card pad"><p>Обработка файла…</p><div class="progress"><i></i></div></div>':''}
  ${p&&!busy?`<div class="summary" data-classifier-status="${esc(p.status)}"><span class="s-chip">${p.counts.total} записей</span><span class="s-chip">${partial?'Нужно уточнить поля':confirmed?'Результат подтверждён':'Поля распознаны'}</span>${p.counts.unresolved?`<span class="s-chip">${p.counts.unresolved} требуют проверки</span>`:''}</div>
  <div class="head-actions"><input class="input" id="classifier-query" placeholder="Поиск" aria-label="Поиск записей" value="${esc(state.classifierQuery||'')}"><button class="btn" data-action="classifier-filter">Найти</button><select class="input" id="classifier-sort" aria-label="Порядок записей"><option value="ascending">По порядку</option><option value="descending" ${state.classifierDescending?'selected':''}>С конца</option></select></div>
  <div class="table-wrap"><table class="tbl classifier-table"><thead><tr>${CLASSIFIER_FIELDS.map(f=>`<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${p.records.map(r=>`<tr>${CLASSIFIER_FIELDS.map(f=>cellHTML(r,f)).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="head-actions"><button class="btn" data-action="import-page" data-offset="${Math.max(0,p.offset-50)}" ${p.offset===0?'disabled':''}>Previous</button><span class="sub">${p.records.length?p.offset+1:0}–${p.offset+p.records.length} / ${p.filteredTotal}</span><button class="btn" data-action="import-page" data-offset="${p.offset+50}" ${p.offset+50>=p.filteredTotal?'disabled':''}>Next</button></div>
  ${!confirmed?`<details class="card pad" id="classifier-options"><summary>Уточнить поля</summary>${optionsHTML(p)}</details>`:''}
  <details class="card pad"><summary>Дополнительно</summary><div class="head-actions"><button class="btn" data-action="import-copy">Copy source text</button><button class="btn" data-action="classifier-export" data-format="tsv">Экспорт TSV</button><button class="btn" data-action="classifier-export" data-format="csv">Экспорт CSV</button><button class="btn" data-action="classifier-archive" ${!p.counts.total||state.importSaved?'disabled':''}>${state.importSaved?'Сохранено в архиве':partial?'Сохранить распознанное в архив':'Сохранить в архив'}</button></div><p class="sub">Строка, таблица и экспорт: ФИО, ID, два пароля, почта, дата рождения и ГЕО.</p>${p.records.filter(r=>r.unrecognized?.length).map(r=>`<p class="sub">Запись ${esc(r.data.rowNumber)}: ${r.unrecognized.length} нераспознанных значений. <details><summary>Посмотреть</summary>${r.unrecognized.map(v=>`<p>${esc(String(v.value).slice(0,80))}${String(v.value).length>80?'…':''}</p>`).join('')}</details></p>`).join('')}${p.diagnostics.length?'<p class="sub">Есть предупреждения: проверьте неоднозначные поля и соответствие ID в cookie.</p>':''}</details>`:''}
  ${!p&&!busy?`<details class="card pad" id="classifier-options" open><summary>Формат файла</summary>${optionsHTML(null)}</details><label class="drop" id="drop" for="file-input"><div class="di">${I.upload}</div><h3>Drop your file here</h3><p>or browse your computer</p><input type="file" id="file-input" accept=".txt,.csv,.tsv,.json" hidden></label><button class="btn btn-quiet" data-action="import-sample">Load synthetic sample</button>`:''}
  </div>`;
}
