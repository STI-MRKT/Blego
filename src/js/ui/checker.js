import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const SHOW_LIMIT = 500;

const LIVE = {
  active: { label: 'Active', tone: 'ok' },
  unavailable: { label: 'Unavailable', tone: 'err' },
  not_found: { label: 'Not found', tone: 'err' },
  login: { label: 'Login wall', tone: 'warn' },
  unknown: { label: 'Unknown', tone: '' },
  unreachable: { label: 'Unreachable', tone: 'warn' }
};

function liveCell(row) {
  if (!row.check) return '<span class="faint">—</span>';
  const meta = LIVE[row.check.status] || LIVE.unknown;
  const title = row.check.error || row.check.title || '';
  const ms = row.check.ms ? `<span class="faint" style="font-size:9.5px;margin-left:6px">${row.check.ms} ms</span>` : '';
  return `<span class="pill ${meta.tone}" title="${esc(title)}">${meta.label}</span>${ms}`;
}

export function checkerHTML() {
  const { input, rows, checking } = state.checker;
  const numeric = rows ? rows.filter((row) => row.type === 'numeric').length : 0;
  const vanity = rows ? rows.filter((row) => row.type === 'vanity').length : 0;
  const invalid = rows ? rows.filter((row) => row.type === 'invalid').length : 0;
  const checked = rows ? rows.filter((row) => row.check).length : 0;
  const active = rows ? rows.filter((row) => row.check?.status === 'active').length : 0;
  const hasLinks = Boolean(rows && rows.some((row) => row.link));
  const progress = checking && checking.total ? Math.round((checking.done / checking.total) * 100) : 0;
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">TOOLS</div><h1>Checker</h1>
        <p class="sub">Paste IDs or profile links — new line, comma or space. Duplicates are removed and formats validated locally. Live status asks Facebook directly, so results depend on the network.</p></div>
    </div>
    <div class="card pad checker-card">
      <label class="fl" for="checker-input">IDs or profile links</label>
      <textarea class="input checker-input" id="checker-input" data-input="checker" spellcheck="false" placeholder="100089123456789&#10;https://www.facebook.com/profile.php?id=100089123456789&#10;zuck">${esc(input)}</textarea>
      <div class="checker-actions">
        <span class="faint" id="checker-count">${input.trim() ? input.trim().split(/[\s,;|]+/).filter(Boolean).length : 0} tokens</span>
        <span style="flex:1"></span>
        <button class="btn btn-quiet" data-action="checker-clear">Clear</button>
        <button class="btn btn-quiet" data-action="checker-status" ${hasLinks && !checking ? '' : 'disabled'}>${checking ? '<span class="spinner"></span>Checking' : `${I.shield}Live status`}</button>
        <button class="btn btn-primary" data-action="checker-run" ${input.trim() ? '' : 'disabled'}>${I.check}Check</button>
      </div>
    </div>
    ${checking ? `<div class="card pad checker-summary" id="checker-progress-card">
      <div class="checker-progress-head"><span class="spinner"></span><span id="checker-progress-text">Checking live status ${checking.done} of ${checking.total}</span><b style="margin-left:auto">${progress}%</b></div>
      <div class="checker-bar"><i id="checker-progress-fill" style="width:${progress}%"></i></div>
    </div>` : ''}
    ${rows ? `<div class="summary checker-summary">
      <span class="s-chip"><b>${rows.length}</b> unique</span>
      <span class="s-chip" style="color:var(--ok)"><span class="dot ok"></span><b>${numeric}</b> numeric</span>
      <span class="s-chip" style="color:var(--accent)"><span class="dot"></span><b>${vanity}</b> vanity</span>
      <span class="s-chip" style="color:var(--err)"><span class="dot err"></span><b>${invalid}</b> invalid</span>
      ${checked ? `<span class="s-chip" style="color:var(--ok)"><b>${active}</b> active</span>` : ''}
    </div>
    <div class="table-wrap checker-table">
      <table class="tbl">
        <thead><tr><th style="width:44px">#</th><th>ID</th><th style="width:92px">Type</th><th style="width:120px">Format</th><th style="width:132px">Live status</th><th style="width:210px">Profile link</th></tr></thead>
        <tbody>
          ${rows.slice(0, SHOW_LIMIT).map((row, index) => `<tr class="checker-row" style="animation-delay:${Math.min(index * 12, 600)}ms">
            <td class="num">${index + 1}</td>
            <td><div class="cell-box"><span class="cell-val mono" data-action="cell-expand" title="${esc(row.id)}">${esc(row.id)}</span><button class="copy tiny" data-action="copy" data-copy="${esc(row.id)}" aria-label="Copy">${I.copy}</button></div></td>
            <td><span class="pill ${row.type === 'invalid' ? 'err' : row.type === 'vanity' ? 'accent' : ''}">${row.type}</span></td>
            <td class="muted">${row.status}</td>
            <td class="muted" data-live="${esc(row.id)}">${liveCell(row)}</td>
            <td>${row.link ? `<div class="checker-link"><a class="mono" href="${esc(row.link)}" target="_blank" rel="noreferrer noopener">${esc(row.link.replace('https://www.', ''))}</a><button class="copy tiny always" data-action="copy" data-copy="${esc(row.link)}" aria-label="Copy link">${I.copy}</button></div>` : '<span class="faint">—</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${rows.length > SHOW_LIMIT ? `<p class="faint" style="font-size:10.5px;margin-top:8px">Showing first ${SHOW_LIMIT} of ${rows.length} IDs</p>` : ''}
    <p class="faint" style="font-size:10.5px;margin-top:8px">Format check is local. Live status requests the public profile and classifies the response as active, unavailable, login wall or unreachable. No login or Meta API key is used.</p>` : ''}
  </div>`;
}
