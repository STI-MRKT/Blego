import { state } from '../state.js';
import { esc } from '../utils/dom.js';
export function historyHTML() {
  const view = state.archiveView;
  if (view) {
    const e = view.entry;
    return `<div class="page"><div class="page-head">
      <div><div class="eyebrow">АРХИВ</div><h1>${esc(e.originalName)}</h1><p class="sub">${esc(e.processedAt)}</p></div>
      <div class="head-actions"><button class="btn" data-action="archive-back">Назад</button></div>
    </div>
    <div class="card pad"><div class="head-actions">
      <button class="btn btn-primary" data-action="copy-model" data-source="archive-open" data-field="resultText" data-personal="true">Копировать результат</button>
      <button class="btn" data-action="archive-export" data-id="${esc(e.archiveId)}" data-kind="txt">Скачать TXT</button>
      <button class="btn" data-action="archive-export" data-id="${esc(e.archiveId)}">Скачать ZIP</button>
    </div><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:480px;overflow:auto">${esc(view.resultText)}</pre></div>
    <details class="card pad"><summary>Дополнительные действия и диагностика</summary>
      <div class="head-actions">
        <button class="btn" data-action="archive-folder" data-id="${esc(e.archiveId)}">Открыть папку</button>
        <button class="btn btn-danger" data-action="archive-delete" data-id="${esc(e.archiveId)}">Удалить…</button>
      </div><pre style="white-space:pre-wrap">${esc(view.unresolvedText)}\n${esc(view.diagnostics)}</pre>
    </details></div>`;
  }
  const q = state.archiveQuery || {};
  const items = state.archives.items || [];
  return `<div class="page">
    <div class="page-head"><div><div class="eyebrow">ЛОКАЛЬНОЕ ХРАНИЛИЩЕ</div><h1>Архив</h1>
      <p class="sub">${state.archives.total || 0} ZIP-файлов</p></div></div>
    <form class="card controls" id="archive-filter">
      <input class="input" name="search" placeholder="Поиск по названию файла" value="${esc(q.search || '')}">
      <button class="btn btn-primary">Найти</button>
      <details><summary>Фильтры</summary>
        <input class="input" name="from" type="date" value="${esc(q.from || '')}">
        <input class="input" name="to" type="date" value="${esc(q.to || '')}">
        <select class="input" name="status"><option value="">Все</option>
          <option ${q.status === 'completed' ? 'selected' : ''}>completed</option>
          <option ${q.status === 'partial_confirmed' ? 'selected' : ''}>partial_confirmed</option></select>
        <select class="input" name="order"><option value="newest">Сначала новые</option>
          <option value="oldest" ${q.order === 'oldest' ? 'selected' : ''}>Сначала старые</option></select>
      </details>
    </form>
    ${state.archives.recoveryReports?.some((r) => r.errors?.length) ? '<div class="banner warn">Некоторые архивы требуют восстановления.</div>' : ''}
    <div class="hlist">
      ${items.length ? items.map((e) => `<div class="hrow">
        <div class="fi">ZIP</div>
        <div><button class="btn btn-quiet nm" data-action="archive-open" data-id="${esc(e.archiveId)}">${esc(e.originalName)}</button>
          <div class="mt">${esc(e.processedAt)}</div></div>
        <span class="pill tiny">${esc(e.status)}</span>
      </div>`).join('') : '<div class="card empty"><h3>Пока нет архивов</h3><p>Здесь появятся подтверждённые результаты обработки.</p></div>'}
    </div>
    <div class="head-actions"><button class="btn" data-action="archive-page" data-offset="${Math.max(0, (state.archives.offset || 0) - 50)}" ${!state.archives.offset ? 'disabled' : ''}>Назад</button>
      <button class="btn" data-action="archive-page" data-offset="${(state.archives.offset || 0) + 50}" ${(state.archives.offset || 0) + 50 >= (state.archives.total || 0) ? 'disabled' : ''}>Далее</button></div>
  </div>`;
}
