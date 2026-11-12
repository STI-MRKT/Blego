import { resolveFileOperations } from '../../../shared/image-workspace.mjs';
import { state } from '../state.js';
import { esc } from './dom.js';
import { toast } from './toast.js';
import { copyText } from './clipboard.js';
import { copySource } from '../../../shared/copy-sources.mjs';
import { serializeCopy } from '../../../shared/copy-format.mjs';
let preferences = {},
  panel = null,
  loading = 0;
const selections = new Map(),
  sequence = new Map();
const sourceForView = () =>
  state.view === 'history' && state.archiveView ? 'archive-open' : state.view;
const prefKey = (id) =>
  id === 'generator'
    ? `generator-${state.demo?.country || state.locale}-${state.demo?.type || state.type}`
    : id;
export async function initCopyPreferences() {
  preferences = await window.blego.copyPreferences();
}
export async function resolveCopySource(id) {
  if (id === 'generator') return copySource(id, state.demo);
  if (id === 'checker') return copySource(id, state.checker.rows);
  if (id === 'network') return copySource(id, state.network.proxy, { direct: state.network });
  if (id === 'news') return copySource(id, state.news);
  if (id === 'photos' || id === 'image-group')
    return copySource(
      'photos',
      state.photos
        .filter(
          (p) =>
            id !== 'image-group' ||
            state.imageWorkspace?.membership[p.fileId] === (state.imageGroupId || 'ungrouped')
        )
        .map((p) => ({
          ...p,
          groupName: state.imageWorkspace?.groups.find(
            (g) => g.id === state.imageWorkspace.membership[p.fileId]
          )?.name,
          effectiveOperations: state.imageWorkspace?.membership[p.fileId]
            ? resolveFileOperations(state.imageWorkspace, p.fileId)
            : [],
          beforeAfter: state.metadataPlan?.files.find((f) => f.fileId === p.fileId)?.beforeAfter
        }))
    );
  if (id === 'image-report') return copySource(id, state.metadataExport);
  if (id === 'archive-open') return copySource(id, state.archiveView);
  if (id === 'history') {
    const list = async (query) => {
      const items = [];
      for (let offset = 0; ; offset += 50) {
        const page = await window.blego.listArchives({ ...query, offset });
        items.push(...page.items);
        if (items.length >= page.total) break;
      }
      return items;
    };
    const items = await list({}),
      filtered = await list(state.archiveQuery || {});
    return copySource(id, { items, filteredIds: filtered.map((r) => r.archiveId) });
  }
  if (id === 'import-source')
    return copySource(id, {
      text: state.importData ? await window.blego.importText(state.importData.operationId) : ''
    });
  if (id === 'import' || id === 'import-diagnostics') {
    if (!state.importData) return copySource(id, { columns: [], records: [], diagnostics: [] });
    const operationId = state.importData.operationId,
      records = [],
      diagnostics = new Map();
    let columns = [];
    for (let offset = 0; ; offset += 50) {
      const page = await window.blego.importPage({ operationId, offset });
      columns = page.columns;
      records.push(...page.records);
      for (const d of page.diagnostics) diagnostics.set(JSON.stringify(d), d);
      if (records.length >= page.counts.total) break;
    }
    if (state.importData?.operationId !== operationId) throw Error('COPY_SELECTION_CHANGED');
    return copySource(id, { columns, records, diagnostics: [...diagnostics.values()] });
  }
  throw Error('INVALID_COPY_SOURCE');
}
function availableSources() {
  const id = sourceForView();
  return id === 'import'
    ? ['import', 'import-source', 'import-diagnostics']
    : id === 'photos'
      ? ['photos', 'image-group', 'image-report']
      : [id];
}
export function mountCopyActions() {
  const host = document.getElementById('view');
  if (
    !host ||
    !['generator', 'import', 'history', 'checker', 'network', 'news', 'photos'].includes(state.view)
  )
    return;
  const bar = document.createElement('div');
  bar.className = 'copy-options';
  bar.id = 'copy-actions';
  bar.innerHTML =
    '<button class="btn" data-copy-action="open">More copy options</button><div id="copy-panel"></div>';
  (host.querySelector('.page') || host).append(bar);
  // A previously prepared panel is an explicit snapshot, not silently replaced by live updates.
  if (panel && panel.view === state.view) renderPanel();
}
function rowLabel(row) {
  const entries = panel.model.fields
    .filter((f) => !f.sensitivity || f.sensitivity === 'public')
    .slice(0, 2);
  return (
    entries
      .map((f) => (row.massValues || row.values)[f.key] || '')
      .join(' · ')
      .slice(0, 160) || row.id
  );
}
function filteredRows() {
  const byId = new Map(panel.model.rows.map((row) => [row.id, row]));
  const ordered = panel.model.filteredIds
    ? panel.model.filteredIds.map((id) => byId.get(id)).filter(Boolean)
    : panel.model.rows;
  return ordered.filter(
    (row) =>
      !panel.query || rowLabel(row).toLocaleLowerCase().includes(panel.query.toLocaleLowerCase())
  );
}
function renderPanel() {
  const node = document.getElementById('copy-panel');
  if (!node || !panel) return;
  const active = document.activeElement;
  const focusKey =
    active && node.contains(active)
      ? {
          action: active.dataset.copyAction,
          row: active.dataset.row,
          check: active.dataset.copyRow
        }
      : null;
  const rows = filteredRows(),
    selected = selections.get(panel.id) || new Set(),
    offset = Math.min(panel.offset, Math.max(0, Math.floor((rows.length - 1) / 50) * 50));
  panel.offset = offset;
  node.innerHTML = `<p class="sub">Snapshot: ${panel.model.rows.length} total · ${rows.length} filtered · ${selected.size} selected. Rows on other pages remain selected. Missing values stay empty.</p><div class="controls"><label class="fl">Source<select class="input" data-copy-control="source">${availableSources()
    .map((id) => `<option ${id === panel.id ? 'selected' : ''}>${esc(id)}</option>`)
    .join(
      ''
    )}</select></label><label class="fl">Scope<select class="input" data-copy-control="scope">${['all', 'filter', 'selected'].map((s) => `<option ${s === panel.scope ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fl">Format<select class="input" data-copy-control="format">${['values', 'labelled', 'json', 'tsv'].map((s) => `<option ${s === panel.format ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="fl">TSV mode<select class="input" data-copy-control="safety"><option value="spreadsheet" ${panel.safety === 'spreadsheet' ? 'selected' : ''}>Spreadsheet safe (escapes formulas/IDs)</option><option value="raw" ${panel.safety === 'raw' ? 'selected' : ''}>Raw (may execute formulas in a spreadsheet)</option></select></label></div>
 <label class="fl">Field order (JSON list; omitted fields are excluded)<input class="input" data-copy-control="order" value="${esc(JSON.stringify(panel.order))}"></label><label class="fl"><input type="checkbox" data-copy-control="personal" ${panel.personal ? 'checked' : ''}> Include personal metadata / source text / owner comments explicitly</label><label class="fl">Filter these rows<input class="input" data-copy-control="query" value="${esc(panel.query)}"></label><div class="head-actions"><button class="btn" data-copy-action="filter">Apply filter</button><button class="btn" data-copy-action="select-filter">Select all filtered</button><button class="btn" data-copy-action="clear-selection">Clear selection</button><button class="btn" data-copy-action="preview">Preview copy</button><button class="btn" data-copy-action="refresh">Refresh snapshot</button><button class="btn" data-copy-action="close">Close</button></div>
 <div class="table-wrap"><table class="tbl"><thead><tr><th>Select</th><th>Record</th><th>Copy row / field</th></tr></thead><tbody>${rows
   .slice(offset, offset + 50)
   .map(
     (row) =>
       `<tr><td><input type="checkbox" data-copy-row="${esc(row.id)}" ${selected.has(row.id) ? 'checked' : ''}></td><td>${esc(rowLabel(row))}</td><td><button class="btn" data-copy-action="row" data-row="${esc(row.id)}">Copy row</button><select class="input" data-row-field="${esc(row.id)}">${panel.model.fields
         .filter((f) => !['secret', 'internal'].includes(f.sensitivity))
         .map(
           (f) =>
             `<option value="${esc(f.key)}">${esc(f.label || f.key)}${f.sensitivity === 'personal' ? ' (personal)' : ''}</option>`
         )
         .join(
           ''
         )}</select><button class="btn" data-copy-action="field" data-row="${esc(row.id)}">Copy chosen value</button></td></tr>`
   )
   .join(
     ''
   )}</tbody></table></div><button class="btn" data-copy-action="previous" ${offset ? '' : 'disabled'}>Previous rows</button><span>${offset + 1}–${Math.min(offset + 50, rows.length)} / ${rows.length}</span><button class="btn" data-copy-action="next" ${offset + 50 < rows.length ? '' : 'disabled'}>Next rows</button>
 ${panel.id === 'generator' && panel.model.rows.length ? `<div class="card pad"><p>Sequential field: ${esc(panel.order[sequence.get(prefKey(panel.id)) || 0] || '')}</p><button class="btn" data-copy-action="sequence-previous">Previous field</button><button class="btn" data-copy-action="sequence-copy">Copy field and advance</button><button class="btn" data-copy-action="sequence-next">Next field</button></div>` : ''}
 <div id="copy-preview"></div>`;
  if (focusKey)
    [...node.querySelectorAll('[data-copy-action],[data-copy-row]')]
      .find(
        (el) =>
          el.dataset.copyAction === focusKey.action &&
          el.dataset.row === focusKey.row &&
          el.dataset.copyRow === focusKey.check
      )
      ?.focus({ preventScroll: true });
}
async function openPanel(id = sourceForView()) {
  const run = ++loading,
    view = state.view,
    model = await resolveCopySource(id);
  if (run !== loading || view !== state.view) return;
  const pref = preferences[prefKey(id)],
    keys = model.fields.map((f) => f.key),
    saved = pref?.order.filter((k) => keys.includes(k));
  panel = {
    view,
    id,
    model,
    order: saved?.length ? saved : keys,
    format: pref?.format || 'labelled',
    scope: 'all',
    personal: false,
    safety: 'spreadsheet',
    query: '',
    offset: 0
  };
  if (!selections.has(id)) selections.set(id, new Set());
  renderPanel();
}
function capture() {
  const el = (name) => document.querySelector(`[data-copy-control="${name}"]`);
  panel.order = JSON.parse(el('order').value);
  if (!Array.isArray(panel.order) || panel.order.some((k) => typeof k !== 'string'))
    throw Error('INVALID_COPY_FIELDS');
  panel.format = el('format').value;
  panel.scope = el('scope').value;
  panel.personal = el('personal').checked;
  panel.safety = el('safety').value;
  panel.query = el('query').value;
}
async function payload(extra = {}) {
  const model = structuredClone(panel.model);
  model.filteredIds = filteredRows().map((r) => r.id);
  return serializeCopy(
    {
      sourceIds: [panel.id],
      scope:
        panel.id === 'generator' &&
        ['all', 'filter'].includes(panel.scope) &&
        (panel.scope !== 'filter' || model.filteredIds.length)
          ? 'card'
          : panel.scope,
      format: panel.format,
      orderedFields: panel.order,
      selection:
        panel.id === 'generator' && ['all', 'filter'].includes(panel.scope)
          ? model.rows.map((r) => r.id)
          : [...(selections.get(panel.id) || [])],
      includePersonal: panel.personal,
      safetyMode: panel.safety,
      ...extra
    },
    {
      resolveSource: async () => model,
      revealedFields: panel.personal
        ? model.fields.filter((f) => f.sensitivity === 'personal').map((f) => f.key)
        : []
    }
  );
}
export async function copyModelValue(
  id,
  rowId,
  key,
  button,
  { card = false, personal = false } = {}
) {
  const model = await resolveCopySource(id),
    row = model.rows.find((r) => r.id === String(rowId)) || (!rowId ? model.rows[0] : null);
  if (!row) throw Error('COPY_SELECTION_CHANGED');
  const result = await serializeCopy(
    {
      sourceIds: [id],
      scope: card ? 'card' : 'value',
      selection: [row.id],
      orderedFields: card
        ? preferences[prefKey(id)]?.order.filter((k) => model.fields.some((f) => f.key === k)) ||
          model.fieldOrder ||
          model.fields.map((f) => f.key)
        : [key],
      format: card ? 'labelled' : 'text',
      includePersonal: personal
    },
    { resolveSource: async () => model, revealedFields: personal ? [key] : [] }
  );
  return copyText(result.text, button);
}
document.addEventListener('change', async (event) => {
  try {
    if (event.target.matches('[data-copy-row]')) {
      const set = selections.get(panel.id);
      event.target.checked
        ? set.add(event.target.dataset.copyRow)
        : set.delete(event.target.dataset.copyRow);
      capture();
      renderPanel();
    }
    if (event.target.matches('[data-copy-control="source"]')) await openPanel(event.target.value);
    else if (event.target.matches('[data-copy-control]'))
      document.getElementById('copy-preview')?.replaceChildren();
  } catch (e) {
    toast(e.message, 'err');
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy-action]');
  if (!button) return;
  try {
    const action = button.dataset.copyAction;
    if (action === 'open') return await openPanel();
    if (action === 'close') {
      panel = null;
      document.getElementById('copy-panel').replaceChildren();
      return;
    }
    if (action === 'refresh') return await openPanel(panel.id);
    capture();
    if (action === 'filter') {
      panel.offset = 0;
      renderPanel();
      return;
    }
    if (action === 'next' || action === 'previous') {
      panel.offset += action === 'next' ? 50 : -50;
      renderPanel();
      return;
    }
    if (action === 'select-filter' || action === 'clear-selection') {
      selections.set(
        panel.id,
        new Set(action === 'select-filter' ? filteredRows().map((r) => r.id) : [])
      );
      renderPanel();
      return;
    }
    if (action === 'preview') {
      const result = await payload();
      panel.prepared = result;
      document.getElementById('copy-preview').innerHTML =
        `<p>${result.rowCount} rows · ${result.byteLength} bytes. Excluded: ${esc(result.redactions.join(', ') || 'none')}. ${esc(result.warnings.join(', '))}</p><p>${result.text.length > 5000 ? 'Preview shows the first 5,000 characters; copying includes the full prepared payload.' : 'Full preview below.'}</p><pre style="white-space:pre-wrap;max-height:240px;overflow:auto">${esc(result.text.slice(0, 5000))}</pre><button class="btn btn-primary" data-copy-action="commit">Copy prepared snapshot</button>`;
      preferences[prefKey(panel.id)] = { format: panel.format, order: panel.order };
      await window.blego.saveCopyPreferences(preferences);
      return;
    }
    if (action === 'commit') {
      if (panel.prepared) await copyText(panel.prepared.text, button);
      return;
    }
    if (action === 'field' || action === 'row') {
      const key = [...document.querySelectorAll('[data-row-field]')].find(
        (el) => el.dataset.rowField === button.dataset.row
      )?.value;
      const result = await payload({
        scope: action === 'field' ? 'value' : 'card',
        format: action === 'field' ? 'text' : panel.format,
        selection: [button.dataset.row],
        ...(action === 'field' ? { orderedFields: [key] } : {})
      });
      await copyText(result.text, button);
      return;
    }
    if (action.startsWith('sequence-')) {
      const key = prefKey(panel.id),
        index = sequence.get(key) || 0;
      if (action === 'sequence-copy') {
        const result = await payload({
          scope: 'value',
          format: 'text',
          selection: [panel.model.rows[0].id],
          orderedFields: [panel.order[index]]
        });
        const copied = await copyText(result.text);
        if (!copied.ok) return;
      }
      sequence.set(
        key,
        Math.max(
          0,
          Math.min(panel.order.length - 1, index + (action === 'sequence-previous' ? -1 : 1))
        )
      );
      renderPanel();
    }
  } catch (error) {
    toast(
      error.code === 'COPY_TOO_LARGE'
        ? 'Larger than 10 MiB. Export a file instead.'
        : error.message,
      'err'
    );
  }
});
document.addEventListener('keydown', (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === 'c' &&
    !event.target.closest('input,textarea,[contenteditable="true"]') &&
    !window.getSelection()?.toString() &&
    document.getElementById('copy-actions')
  ) {
    event.preventDefault();
    const id = sourceForView();
    resolveCopySource(id)
      .then((model) =>
        model.rows.length === 1
          ? copyModelValue(id, model.rows[0].id, null, null, { card: true })
          : openPanel(id)
      )
      .catch((e) => toast(e.message, 'err'));
  }
});
