import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { decoderErrorMessage, MAX_INPUT_LENGTH } from '../../../shared/string-decoder.mjs';

const formats = [
  ['auto', 'Автоопределение'],
  ['base64', 'Base64'],
  ['base64url', 'Base64 URL-safe'],
  ['url', 'URL-encoding'],
  ['hex', 'Hex']
];

export function decoderResultHTML() {
  const d = state.decoder || {};
  const status = d.status || 'idle';
  const title = status === 'success' ? (d.json ? 'JSON' : 'Текст') : 'Результат';
  const summary =
    status === 'success'
      ? '<span class="decoder-summary">Уровней декодирования: ' + d.layers +
        (d.embedded ? ' · JSON-фрагментов: ' + d.fragments : '') +
        ' · Формат: ' + esc((d.detected || []).join(' → ') || d.format) + '</span>'
      : '';
  return `<div class="decoder-output-head">
      <div><h2>${title}</h2>${summary}</div>
      <button type="button" class="btn btn-quiet" data-action="decoder-copy" ${status !== 'success' ? 'disabled' : ''}>${I.copy} Копировать результат</button>
    </div>
    ${status === 'success'
      ? `<pre id="decoder-result" class="decoder-output" aria-label="Декодированная строка" tabindex="0">${esc(d.output)}</pre>`
      : status === 'error'
        ? `<div class="decoder-error" role="alert">${esc(decoderErrorMessage(d.error))}</div>`
        : status === 'loading'
          ? '<p class="decoder-placeholder" role="status">Декодирование…</p>'
          : '<p class="decoder-placeholder" id="decoder-result-placeholder">Результат появится после декодирования.</p>'}`;
}

export function decoderHTML() {
  const d = state.decoder || { input: '', format: 'auto', status: 'idle' };
  return `<div class="page decoder-page" id="decoder-page" data-decoder-status="${esc(d.status || 'idle')}">
    <div class="page-head">
      <div>
        <h1>Декодер строк</h1>
        <p class="sub">Base64, URL-safe, URL-кодирование и Hex. Данные обрабатываются только в приложении.</p>
      </div>
    </div>
    <div class="decoder-grid">
      <section class="card pad decoder-panel">
        <label class="fl" for="decoder-input">Закодированная строка</label>
        <textarea class="input decoder-textarea" id="decoder-input" spellcheck="false" autocomplete="off"
          maxlength="${MAX_INPUT_LENGTH}" placeholder="Пример: W3siZmllbGQiOiJ0ZXN0In1d" aria-describedby="decoder-input-help">${esc(d.input || '')}</textarea>
        <p class="sub" id="decoder-input-help">Можно вставить составную строку: в автоматическом режиме декодер найдёт встроенный Base64 с JSON. Максимум 2 МиБ.</p>
        <label class="fl" for="decoder-format">Формат
          <select class="input" id="decoder-format">
            ${formats.map(([key, label]) => `<option value="${key}" ${d.format === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <div class="decoder-actions">
          <button type="button" class="btn btn-primary" data-action="decoder-decode" ${d.status === 'loading' ? 'disabled' : ''}>${I.bolt} Декодировать</button>
          <button type="button" class="btn btn-quiet" data-action="decoder-clear">${I.trash} Очистить</button>
        </div>
        <p class="sub">Base64: допускаются переносы. URL: %XX и + как пробел. Hex: пары байтов, можно через пробел. До трёх уровней вложенности.</p>
      </section>
      <section class="card pad decoder-panel" id="decoder-result-panel" aria-live="polite">${decoderResultHTML()}</section>
    </div>
    <p class="sub decoder-privacy">Строки не сохраняются, не анализируются удалёнными службами и не включаются в журналы приложения. Очистка удаляет введённое и результат из текущего окна.</p>
  </div>`;
}
