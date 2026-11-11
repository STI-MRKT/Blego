import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { fmtDate } from '../utils/time.js';
import { cellHTML } from './cell.js';

function entryModalHTML() {
  const entry = state.history.find((item) => item.id === state.modal.id);
  if (!entry) return '';
  return `<div class="modal wide">
    <div class="modal-head">
      <div><h3>${esc(entry.name)}</h3><p>${entry.rows.length} records · ${entry.kind} · ${fmtDate(entry.date)}</p></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Close">${I.x}</button>
    </div>
    <div class="modal-body">
      ${entry.status === 'partial' ? `<div class="banner warn">${I.alert}<div>Some rows were parsed with warnings.</div></div>` : ''}
      <div class="table-wrap" style="max-height:46vh;overflow:auto">
        <table class="tbl">
          <thead><tr>${entry.columns.map((column) => `<th>${esc(column)}</th>`).join('')}<th style="width:40px"></th></tr></thead>
          <tbody>
            ${entry.rows.slice(0, 120).map((row) => `<tr>
              ${entry.columns.map((column) => cellHTML(row[column])).join('')}
              <td><button class="copy" data-action="copy" data-copy="${esc(entry.columns.map((column) => `${column}: ${row[column] || ''}`).join(' | '))}" aria-label="Copy row">${I.copy}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${entry.rows.length > 120 ? `<p class="faint" style="font-size:10.5px;margin-top:8px">Showing the first 120 rows</p>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" data-action="ask-delete" data-id="${entry.id}">${I.trash}Delete</button>
      <span style="flex:1"></span>
      <button class="btn" data-action="close-modal">Close</button>
    </div>
  </div>`;
}

function deleteModalHTML() {
  return `<div class="modal sm">
    <div class="modal-head"><div><h3>Delete this entry?</h3><p>The file and parsed data will be removed from this session’s history.</p></div></div>
    <div class="modal-foot">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn btn-danger" data-action="delete-entry" data-id="${state.modal.id}">${I.trash}Delete</button>
    </div>
  </div>`;
}

export function renderModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  if (!state.modal) {
    root.innerHTML = '';
    return;
  }
  let content = '';
  if (state.modal.type === 'entry') content = entryModalHTML();
  if (state.modal.type === 'delete') content = deleteModalHTML();
  root.innerHTML = `<div class="overlay" data-action="overlay">${content}</div>`;
}
