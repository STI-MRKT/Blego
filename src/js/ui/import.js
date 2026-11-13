import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { I } from '../icons.js';
import { CLASSIFIER_FIELDS } from '../../../shared/classifier.mjs';
export const isCookieColumn = name => /^(?:cookies?(?:_?json)?|куки)$/i.test(String(name || '').trim().replace(/[\s-]/g, '_'));
function cellHTML(record, field) {
  const raw = record.data[field.key] || '';
  const long = ['userAgent','token','cookies'].includes(field.key);
  const shown = raw && ['password','emailPassword','token','cookies'].includes(field.key) ? '••••••••' : long && raw.length > 12 ? raw.slice(0,12) + '…' : raw;
  if (field.key === 'rowNumber') return `<td class="num">${esc(raw)}<button class="copy" data-action="classifier-copy-row" data-row="${esc(record.id)}" aria-label="Копировать строку">${I.copy}</button><button class="copy" data-action="classifier-details" data-row="${esc(record.id)}" aria-label="Подробности записи ${esc(raw)}">${I.chevron}</button></td>`;
  return `<td><span class="classifier-value${long ? ' mono' : ''}">${esc(shown)}</span><button class="copy" data-action="${field.key === 'cookies' ? 'import-cookie-copy' : 'classifier-copy-cell'}" data-row="${esc(record.id)}" data-field="${field.key}" aria-label="Копировать ${field.key === 'cookies' ? 'cookie целиком' : esc(field.label)}" ${!raw ? 'disabled' : ''}>${I.copy}</button></td>`;
}

const extraLabels = {profileUrl:'Ссылка профиля',mailServiceUrl:'Почтовый сервис',twoFactorUrl:'Ссылка 2FA',avatarUrl:'Аватар',documentUrl:'Документ',limit:'Лимит',fpStatus:'FP',sentCount:'Отправлено',friendsInfo:'Друзья'};
const warningLabels = {IDENTITY_CONFLICT:'ID в источниках различаются',COOKIE_ID_CONFLICT:'ID не совпадает с владельцем cookie',AMBIGUOUS_FIELD:'Несколько вариантов поля',INVALID_FIELD:'Неверное значение поля',UNRECOGNIZED_VALUES:'Остались нераспознанные значения',INVALID_JSON_CELL:'Повреждённый JSON',INVALID_COOKIE_JSON:'Повреждённый JSON cookie',UNCLOSED_QUOTE:'Незакрытая кавычка',DUPLICATE:'Повтор записи',MISSING_CELL:'Пропущено поле',EXTRA_CELL:'Дополнительное поле'};
function detailValue(record, key, label, raw) {
  const revealed=state.classifierRevealed?.[key]===true;
  const value=String(raw??'');
  return `<div class="field"><label>${esc(label)}</label><div class="head-actions"><span class="mono" data-detail-value="${esc(key)}">${value ? revealed ? esc(value.slice(0,2000))+(value.length>2000?'… (скопируйте полное значение)':'') : '••••••••' : '—'}</span>${value?`<button class="btn btn-quiet" data-action="classifier-reveal" data-row="${esc(record.id)}" data-field="${esc(key)}" aria-pressed="${revealed}">${revealed?'Скрыть':'Показать'}</button><button class="copy" data-action="classifier-copy-cell" data-row="${esc(record.id)}" data-field="${esc(key)}" aria-label="Копировать ${esc(label)}">${I.copy}</button>`:''}</div></div>`;
}
function recordDetailsHTML(p, confirmed) {
  const r=p.records.find(r=>r.id===state.classifierDetailRow);
  if(!r)return '';
  const labels=[...CLASSIFIER_FIELDS.slice(1),...Object.entries(extraLabels).map(([key,label])=>({key,label}))];
  return `<section class="card pad" id="classifier-record-details"><div class="head-actions"><h3>Запись ${esc(r.data.rowNumber)}</h3><span class="s-chip">${r.confidence==='recognized'?'Распознано':r.confidence==='unknown'?'Не распознано':'Требует проверки'}</span><button class="btn btn-quiet" data-action="classifier-close-details">Закрыть</button></div>${r.warnings.map(w=>`<p class="sub">${esc(warningLabels[w.code]||'Проверьте исходное поле')}${w.column?`: ${esc(w.column)}`:''}</p>`).join('')}
  ${labels.filter(f=>r.data[f.key]||r.extended?.[f.key]).map(f=>detailValue(r,f.key,f.label,r.data[f.key]??r.extended[f.key])).join('')}
  <details><summary>Исходные поля и назначение</summary>${(r.sourceEntries||[]).map((e,i)=>`${detailValue(r,'source:'+e.column,`Поле ${i+1}${e.header?' — '+e.header:''}`,typeof e.value==='object'?e.rawText: e.value)}${!confirmed?`<label class="fl">Назначить поле ${i+1}<select class="input" data-classifier-row-map data-row="${esc(r.id)}" data-column="${esc(e.column)}"><option value="">Авто</option>${labels.map(f=>`<option value="${f.key}" ${state.classifierOptions?.recordMapping?.[r.id]?.[e.column]===f.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label>`:''}`).join('')}${!confirmed?'<button class="btn" data-action="classifier-apply-record">Применить к этой записи</button>':''}</details>
  <details><summary>Исходная запись</summary>${detailValue(r,'sourceRecord','Исходный текст',r.sourceRecord)}</details></section>`;
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
  <div class="head-actions"><input class="input" id="classifier-query" placeholder="Поиск" aria-label="Поиск записей" value="${esc(state.classifierQuery||'')}"><button class="btn" data-action="classifier-filter">Найти</button><select class="input" id="classifier-sort" aria-label="Порядок записей"><option value="ascending">По порядку</option><option value="descending" ${state.classifierDescending?'selected':''}>С конца</option></select><label class="fl"><input type="checkbox" id="classifier-warnings-only" ${state.classifierWarningsOnly?'checked':''}> Требуют проверки</label></div>
  <div class="table-wrap"><table class="tbl classifier-table"><thead><tr>${CLASSIFIER_FIELDS.map(f=>`<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${p.records.map(r=>`<tr>${CLASSIFIER_FIELDS.map(f=>cellHTML(r,f)).join('')}</tr>`).join('')}</tbody></table></div>
  ${recordDetailsHTML(p,confirmed)}<div class="head-actions"><button class="btn" data-action="import-page" data-offset="${Math.max(0,p.offset-50)}" ${p.offset===0?'disabled':''}>Previous</button><span class="sub">${p.records.length?p.offset+1:0}–${p.offset+p.records.length} / ${p.filteredTotal}</span><button class="btn" data-action="import-page" data-offset="${p.offset+50}" ${p.offset+50>=p.filteredTotal?'disabled':''}>Next</button></div>
  ${!confirmed?`<details class="card pad" id="classifier-options"><summary>Уточнить поля</summary>${optionsHTML(p)}</details>`:''}
  <details class="card pad" id="classifier-extra" ${state.classifierExtraOpen?'open':''}><summary>Дополнительно</summary><div class="head-actions"><button class="btn" data-action="import-copy">Copy source text</button><button class="btn" data-action="classifier-export" data-format="tsv">Экспорт TSV</button><button class="btn" data-action="classifier-export" data-format="csv">Экспорт CSV</button><button class="btn" data-action="classifier-archive" ${!p.counts.total||state.importSaved?'disabled':''}>${state.importSaved?'Сохранено в архиве':partial?'Сохранить распознанное в архив':'Сохранить в архив'}</button></div><p class="sub">Строка, таблица и экспорт: ФИО, ID, два пароля, почта, дата рождения и ГЕО.</p>${p.diagnostics.length?'<p class="sub">Есть предупреждения: проверьте неоднозначные поля и соответствие ID в cookie.</p>':''}</details>`:''}
  ${!p&&!busy?`<details class="card pad" id="classifier-options" open><summary>Формат файла</summary>${optionsHTML(null)}</details><label class="drop" id="drop" for="file-input"><div class="di">${I.upload}</div><h3>Drop your file here</h3><p>or browse your computer</p><input type="file" id="file-input" accept=".txt,.csv,.tsv,.json" hidden></label><button class="btn btn-quiet" data-action="import-sample">Load synthetic sample</button>`:''}
  </div>`;
}
