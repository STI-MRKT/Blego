(function applyTZ30Columns(){
  'use strict';
  const fs=require('node:fs');
  function edit(p,fn){const prev=fs.readFileSync(p,'utf8'),next=fn(prev);if(next===prev)throw Error('TZ30 copy columns anchor missing: '+p);fs.writeFileSync(p,next);console.log('TZ30 columns patched '+p);}
  edit('src/js/ui/import.js',s=>{
    const before='<thead><tr>${UI_FIELDS.map(f=>`<th>${esc(f.label)}</th>`).join(\'\')}</tr></thead>';
    const after='<thead><tr>${UI_FIELDS.map(f=>`<th>${esc(f.label)}<button type="button" class="copy tiny classifier-column-copy" data-action="classifier-copy-column" data-field="${esc(f.key)}" aria-label="Copy entire column ${esc(f.label)}" title="Copy entire column">${I.copy}</button></th>`).join(\'\')}</tr></thead>';
    if(!s.includes(before))throw Error('missing classifier header');
    return s.replace(before,after);
  });
  edit('src/js/main.js',s=>{
    const anchor="  if (action === 'classifier-copy-row' || action === 'classifier-copy-table') {";
    if(!s.includes(anchor))throw Error('missing classifier copy actions');
    const before=[
      "  if (action === 'classifier-copy-column') {",
      "    const operationId = state.importData?.operationId, epoch = state.importEpoch;",
      "    const field = target.dataset.field;",
      "    const allowed = new Set(['rowNumber','fullName','accountId','password','emailPassword','email','birthDate','geo','cookies','token','userAgent']);",
      "    if (!operationId || !allowed.has(field)) return;",
      "    const options = { query: state.classifierQuery || '', sort: 'rowNumber', descending: !!state.classifierDescending, warningsOnly: !!state.classifierWarningsOnly };",
      "    const unchanged = () => state.view === 'import' && state.importEpoch === epoch && state.importData?.operationId === operationId && options.query === (state.classifierQuery || '') && options.descending === !!state.classifierDescending && options.warningsOnly === !!state.classifierWarningsOnly;",
      "    const values = [];",
      "    target.disabled = true;",
      "    try {",
      "      for (let offset = 0; ; offset += 50) {",
      "        if (!unchanged()) return;",
      "        const page = await window.blego.importPage({ operationId, offset, options });",
      "        if (!unchanged()) return;",
      "        const rows = Array.isArray(page.records) ? page.records : [];",
      "        const full = await Promise.all(rows.map((row) => window.blego.importCell({ operationId, recordId: row.id, field })));",
      "        if (!unchanged()) return;",
      "        for (const value of full) values.push(value == null ? '' : String(value));",
      "        if (!rows.length || offset + rows.length >= page.filteredTotal) break;",
      "      }",
      "      if (!values.length) toast('No values in this column');",
      "      else await copyText(values.join('\\n'), target, 'Column copied');",
      "    } catch { toast('Could not copy this column. Try exporting instead.', 'err'); }",
      "    finally { if (target.isConnected) target.disabled = false; }",
      "    return;",
      "  }",
      anchor
    ].join('\n');
    return s.replace(anchor,before);
  });
  fs.appendFileSync('src/css/tz24.css','\n.classifier-column-copy {display:inline-flex;vertical-align:middle;margin-left:6px;padding:3px;opacity:.78;}\n.classifier-column-copy:hover,.classifier-column-copy:focus-visible {opacity:1;}\n');
  console.log('TZ30 classifier columns ready');
})();
