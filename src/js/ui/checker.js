import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const labels = {
  profile_visible: 'Страница доступна',
  login_required: 'Требуется вход',
  unavailable: 'Страница недоступна',
  challenge_required: 'Нужна проверка',
  request_limited: 'Временное ограничение',
  network_error: 'Ошибка соединения',
  unsupported_target: 'Неподдерживаемая ссылка',
  unknown: 'Нет данных',
  cancelled: 'Отменено'
};
export function checkerHTML() {
  const { input, rows, checking } = state.checker;
  const count = (input || '').split(/\r?\n/).filter((x) => x.trim()).length;
  const percent = checking?.total ? Math.round((100 * checking.done) / checking.total) : 0;
  return `<div class="page">
    <div class="page-head"><div><div class="eyebrow">ПРОВЕРКА</div>
      <h1>Facebook-чекер</h1><p class="sub">Вставьте ссылки или ID аккаунтов — по одному на строку.</p></div></div>
    <div class="card pad checker-card">
      <textarea class="input checker-input" id="checker-input" data-input="checker" spellcheck="false"
        placeholder="100000000000000&#10;https://www.facebook.com/profile.php?id=..." aria-label="Список аккаунтов">${esc(input || '')}</textarea>
      <div class="checker-actions">
        <span id="checker-count" class="faint">${count} шт.</span>
        <button class="btn btn-quiet" data-action="checker-clear">Очистить</button>
        ${checking ? '<button class="btn btn-quiet" data-action="checker-cancel">Стоп</button>' : ''}
        <button class="btn btn-primary" data-action="checker-run"
          ${!input?.trim() || checking ? 'disabled' : ''}>${I.shield}Проверить</button>
      </div>
    </div>
    ${
      checking
        ? `<div class="card pad">
      <div class="checker-progress-head"><span id="checker-progress-text">${checking.done} из ${checking.total}</span><b>${percent}%</b></div>
      <div class="checker-bar"><i id="checker-progress-fill" style="width:${percent}%"></i></div>
    </div>`
        : ''
    }
    ${
      rows
        ? `<div class="table-wrap checker-table"><table class="tbl">
      <thead><tr><th>Аккаунт</th><th>Доступность страницы</th><th>Действие</th></tr></thead>
      <tbody>${rows
        .map(
          (row, index) => `<tr>
        <td><span class="mono cell-val">${esc(row.id || String(row.inputIndex + 1))}</span>
          <button class="copy tiny" data-action="copy-model" data-source="checker" data-row="${index}" data-field="id" aria-label="Copy Facebook ID">${I.copy}</button></td>
        <td><span class="pill ${row.check?.availability === 'profile_visible' ? 'ok' : row.check?.availability === 'network_error' ? 'warn' : ''}">
          ${esc(labels[row.check?.availability] || (row.link ? 'Ожидает проверки' : 'Неверный ввод'))}</span>
          <div class="faint">${row.check ? 'Статус блокировки не установлен' : ''}</div></td>
        <td>${
          row.link
            ? `<button class="btn btn-quiet" data-action="facebook-open" data-target="${esc(row.link)}">Открыть</button>
          <details><summary>Заметка владельца</summary>
            <label class="fl">Моя проверка<select class="input" id="fb-note-status-${index}">
              <option value="not_checked">Не проверял</option><option value="blocked">Есть ограничение</option>
              <option value="not_blocked">Нет ограничений</option></select></label>
            <input class="input" id="fb-note-comment-${index}" maxlength="2000" placeholder="Комментарий">
            <button class="btn" data-action="facebook-note" data-index="${index}">Сохранить</button>
            ${(row.notes || []).map((note) => `<p class="faint">${esc(note.reportedAt)} · ${esc(note.status)}</p>`).join('')}
          </details>`
            : ''
        }</td>
      </tr>`
        )
        .join('')}</tbody></table></div>`
        : ''
    }
  </div>`;
}
