import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { I } from '../icons.js';
const value = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
export const isCookieColumn = (name) =>
  /^(?:cookies?(?:_?json)?|куки)$/i.test(String(name || '').trim().replace(/[\s-]/g, '_'));
function importCellHTML(record, column) {
  const raw = value(record.data[column]);
  const cookie = isCookieColumn(column);
  const shown = cookie && raw.length > 12 ? raw.slice(0, 12) + '…' : raw;
  const action = cookie ? 'import-cookie-copy' : 'copy-model';
  const hint = cookie ? 'Копировать cookie целиком' : 'Копировать';
  return `<td><span${cookie ? ' class="mono"' : ''}>${esc(shown)}</span><button class="copy" data-action="${action}" data-source="import" data-row="${esc(record.id)}" data-field="${esc(column)}" aria-label="${hint}" ${cookie && !raw ? 'disabled' : ''}>${I.copy}</button></td>`;
}
export function importHTML() {
  const p = state.importData;
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">Classification / Import</div><h1>${p ? 'Preview' : 'Data import'}</h1><p class="sub">${esc(state.importName || 'TXT · CSV · TSV · JSON — up to 50 MiB')}</p></div><div class="head-actions">${state.importStep !== 'idle' ? '<button class="btn" data-action="import-reset">Discard / cancel</button>' : ''}${p ? '<button class="btn" data-action="import-copy">Copy source text</button>' : ''}</div></div>
${state.importStep === 'error' ? `<div class="banner err">${esc(state.importError)}</div>` : ''}
${state.importStep === 'loading' ? '<div class="card pad"><p>Reading and parsing locally…</p><div class="progress"><i></i></div></div>' : ''}
${
  p
    ? `<div class="banner warn"><div><b>rules_pending — Classification rules are not configured</b><br>This is a structural preview. It cannot be confirmed or archived as a classified result.</div></div>
<div class="summary"><span class="s-chip">${p.counts.total} source records</span><span class="s-chip">${p.counts.processed} classified</span><span class="s-chip">${p.counts.unresolved} unresolved</span><span class="s-chip">Encoding: ${esc(p.encoding)} (${p.encodingAssumed ? 'assumed' : 'BOM / selected'})</span></div>
<div class="table-wrap"><table class="tbl"><thead><tr><th>Location</th>${p.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${p.records.map((r) => `<tr><td>${esc(JSON.stringify(r.location))}</td>${p.columns.map((c) => importCellHTML(r, c)).join('')}</tr>`).join('')}</tbody></table></div>
<div class="head-actions"><button class="btn" data-action="import-page" data-offset="${Math.max(0, p.offset - 50)}" ${p.offset === 0 ? 'disabled' : ''}>Previous</button><span class="sub">${p.offset + 1}–${p.offset + p.records.length} / ${p.counts.total}</span><button class="btn" data-action="import-page" data-offset="${p.offset + 50}" ${p.offset + 50 >= p.counts.total ? 'disabled' : ''}>Next</button></div>
<details class="card pad"><summary>Diagnostics for this page (${p.diagnostics.length})</summary><pre style="white-space:pre-wrap">${esc(JSON.stringify(p.diagnostics, null, 2))}</pre></details>`
    : ''
}
${
  !p && state.importStep !== 'loading'
    ? `<div class="card pad"><label class="fl">Source encoding<select class="input" id="import-encoding">${[
        ['', 'Auto: BOM, otherwise assume UTF-8'],
        ['utf-8', 'UTF-8'],
        ['utf-16le', 'UTF-16LE'],
        ['utf-16be', 'UTF-16BE'],
        ['windows-1251', 'Windows-1251']
      ]
        .map(
          ([v, label]) =>
            `<option value="${v}" ${state.importEncoding === v ? 'selected' : ''}>${label}</option>`
        )
        .join(
          ''
        )}</select></label></div><label class="drop" id="drop" for="file-input"><div class="di">${I.upload}</div><h3>Drop your file here</h3><p>or browse your computer</p><input type="file" id="file-input" accept=".txt,.csv,.tsv,.json" hidden></label><button class="btn btn-quiet" data-action="import-sample">Load synthetic sample</button>`
    : ''
}</div>`;
}
