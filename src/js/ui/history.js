import { state } from '../state.js';
import { t } from '../i18n.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { rel } from '../utils/time.js';

export function historyFiltered() {
  const query = state.historyQuery.trim().toLowerCase();
  if (!query) return state.history;
  return state.history.filter((entry) => entry.name.toLowerCase().includes(query)
    || entry.rows.some((row) => String(row.owner || '').toLowerCase().includes(query)
      || String(row.project || '').toLowerCase().includes(query)));
}

export function historyRowsHTML() {
  const list = historyFiltered();
  if (!list.length) {
    return `<div class="empty-mini">${state.historyQuery ? t('Ничего не найдено по запросу', 'Nothing matches this search') : t('История пока пуста. Загрузите первый файл.', 'History is empty. Upload your first file.')}</div>`;
  }
  return list.map((entry) => `<div class="hrow" data-action="open-entry" data-id="${entry.id}">
    <div class="fi">${I.file}</div>
    <div style="min-width:0">
      <div class="nm">${esc(entry.name)}</div>
      <div class="mt"><span>${entry.rows.length} ${t('записей', 'records')}</span><span>·</span><span>${entry.kind}</span><span>·</span><span>${esc(entry.rows[0]?.owner || '—')}</span></div>
    </div>
    <div>${entry.status === 'partial' ? `<span class="pill warn">${t('Частично', 'Partial')}</span>` : `<span class="pill ok">${t('Разобран', 'Parsed')}</span>`}</div>
    <div class="time">${rel(entry.date)}</div>
    <button class="icon-btn del" data-action="ask-delete" data-id="${entry.id}" aria-label="${t('Удалить', 'Delete')}">${I.trash}</button>
  </div>`).join('');
}

export function historyHTML() {
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${t('История', 'History')}</div><h1>${t('История импортов', 'Import history')}</h1>
        <p class="sub">${t('Всё, что загружалось в этой сессии: имя файла, дата, количество записей и результат разбора.', 'Everything uploaded in this session: file name, date, record count and parse result.')}</p></div>
      <div class="head-actions"><button class="btn" data-action="set-view" data-view="import">${I.upload}${t('Загрузить файл', 'Upload file')}</button></div>
    </div>
    <div class="history-head">
      <div class="search">${I.search}<input class="input" id="history-search" data-input="history-search" placeholder="${t('Поиск по файлам, владельцам, проектам', 'Search files, owners, projects')}" value="${esc(state.historyQuery)}"></div>
      <span class="faint" style="font-size:11px" id="history-count">${historyFiltered().length} ${t('из', 'of')} ${state.history.length}</span>
    </div>
    <div class="hlist" id="history-list">${historyRowsHTML()}</div>
  </div>`;
}
