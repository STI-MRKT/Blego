(function applyTZ30Archive() {
  'use strict';
  const fs = require('node:fs');
  function swap(s,a,b,id) {
    if(!s.includes(a)) throw Error('TZ30 archive anchor missing: ' + id);
    return s.replace(a,b);
  }
  function edit(p,fn) {
    const old=fs.readFileSync(p,'utf8');
    const next=fn(old);
    if(old===next) throw Error('TZ30 archive no changes: '+p);
    fs.writeFileSync(p,next);
    console.log('TZ30 archive patched '+p);
  }
  edit('electron/features/archive/service.cjs',s=>{
    s=swap(s,
      "const cookies = confirmed.records.map(cookiePayload).filter(Boolean);",
      "const cookies = confirmed.records.map((record, index) => ({ index, payload: cookiePayload(record) })).filter((record) => record.payload);",
      'preserve cookie record indices');
    s=swap(s,
      "cookies.forEach((record, index) => {\n          entries[`cookie-files/cookie-${String(index + 1).padStart(4, '0')}.txt`] = Buffer.from(\n            record,\n            'utf8'\n          );\n        });",
      "cookies.forEach(({ index, payload }) => {\n          entries[`cookie-files/cookie-${String(index + 1).padStart(4, '0')}.txt`] = Buffer.from(\n            payload,\n            'utf8'\n          );\n        });",
      'write original cookie slot');
    s=swap(s,"        testOnly: confirmed.testOnly === true,", "        testOnly: confirmed.testOnly === true,\n        cookieRowsOriginalIndex: options.includeCookies === true,", 'cookie manifest format');
    s=swap(s,"    return { ...data, entry, records: archivedRows(data.entries) };",[
      "    const records = archivedRows(data.entries);",
      "    const cookieNames = Object.keys(data.entries).filter((name) => /^cookie-files\\/cookie-\\d{4}\\.txt$/.test(name)).sort();",
      "    const assigned = new Map();",
      "    const byId = new Map();",
      "    for (const [index, record] of records.entries()) {",
      "      const key = String(record.accountId || '').trim();",
      "      if (!key) continue;",
      "      if (byId.has(key)) byId.set(key, null);",
      "      else byId.set(key, index);",
      "    }",
      "    for (const name of cookieNames) {",
      "      if (entry.cookieRowsOriginalIndex === true) {",
      "        const index = Number(name.match(/cookie-(\\d{4})\\.txt$/)?.[1]) - 1;",
      "        if (Number.isSafeInteger(index) && index >= 0 && index < records.length) assigned.set(index, name);",
      "        continue;",
      "      }",
      "      // Older archives numbered only non-empty cookies. Match by c_user, never by a shifted position.",
      "      try {",
      "        const cookies = JSON.parse(data.entries[name].toString('utf8'));",
      "        const account = Array.isArray(cookies) ? cookies.find((c) => c.name === 'c_user' && /facebook\\.com$/.test(String(c.domain || '')))?.value : null;",
      "        const index = byId.get(String(account || ''));",
      "        if (Number.isSafeInteger(index) && !assigned.has(index)) assigned.set(index, name);",
      "      } catch { /* Unverifiable legacy cookie remains unassigned. */ }",
      "    }",
      "    return { ...data, entry, records, cookieRecordFiles: records.map((_, index) => assigned.get(index) || null) };"
    ].join('\n'),'map archive cookies to owner');
    s=swap(s,"  async function removeArchive(id) {",[
      "  async function readCookie(id, index) {",
      "    if (!Number.isSafeInteger(index) || index < 0) throw Error('ARCHIVE_COOKIE_INVALID');",
      "    const view = await openArchive(id);",
      "    const filename = view.cookieRecordFiles[index];",
      "    if (!filename || !Buffer.isBuffer(view.entries[filename])) throw Error('ARCHIVE_COOKIES_UNAVAILABLE');",
      "    return view.entries[filename].toString('utf8');",
      "  }",
      "  async function readColumn(id, field) {",
      "    const allowed = new Set(['fullName','accountId','password','emailPassword','email','birthDate','geo','cookies']);",
      "    if (!allowed.has(field)) throw Error('INVALID_ARCHIVE_COLUMN');",
      "    const view = await openArchive(id);",
      "    const values = view.records.map((record, index) => field === 'cookies'",
      "      ? (view.cookieRecordFiles[index] ? view.entries[view.cookieRecordFiles[index]].toString('utf8') : '')",
      "      : String(record[field] ?? ''));",
      "    return values.filter((value) => value.length > 0).join('\\n');",
      "  }",
      "  async function removeArchive(id) {"
    ].join('\n'),'archive copy methods');
    s=swap(s,"    exportCookieFiles,\n    removeArchive,","    exportCookieFiles,\n    readCookie,\n    readColumn,\n    removeArchive,",'archive exports');
    return s;
  });
  edit('electron/main.cjs',s=>{
    s=swap(s,"      archiveList: (q) => ({ ...archives.listArchives(q), recoveryReports }),",[
      "      archiveList: (q) => ({ ...archives.listArchives(q), recoveryReports }),",
      "      archiveCookieRead: ({ id, index }) => archives.readCookie(id, index),",
      "      archiveColumnRead: ({ id, field }) => archives.readColumn(id, field),"
    ].join('\n'),'archive IPC handlers');
    s=swap(s,"        const r = await archives.openArchive(id);\n        return {","        const r = await archives.openArchive(id);\n        return {\n          cookieRecordFiles: r.cookieRecordFiles,",'expose separate cookie mapping');
    return s;
  });
  edit('electron/preload.cjs',s=>{
    s=swap(s,"  openArchive: (id) => call('archiveOpen', id),",[
      "  openArchive: (id) => call('archiveOpen', id),",
      "  readArchiveCookie: (arg) => call('archiveCookieRead', arg),",
      "  readArchiveColumn: (arg) => call('archiveColumnRead', arg),"
    ].join('\n'),'archive preload accessors');
    return s;
  });
  edit('src/js/ui/history.js',s=>{
    s=swap(s,"  ['geo', 'GEO']\n];", "  ['geo', 'GEO'],\n  ['cookies', 'Cookie']\n];",'archive cookie field');
    s=swap(s,"function recordField(row, index, key, label) {\n  const value",[
      "function recordField(row, index, key, label, cookieFile) {",
      "  if (key === 'cookies') {",
      "    const available = Boolean(cookieFile);",
      '    return `<button type="button" class="field archive-record-field archive-cookie-field" data-action="archive-cookie-copy" data-row="${index}" aria-label="Copy Cookie for record ${index + 1}" ${available ? "" : "disabled"}><span class="field-main"><span class="field-label">COOKIE</span><span class="field-value archive-record-value">${available ? "Copy full Cookie" : "—"}</span></span></button>`;',
      "  }",
      "  const value"
    ].join('\n'),'archive cookie record card');
    const oldButton="${cookies.length ? `<button class=\"btn\" data-action=\"archive-export-cookies\" data-id=\"${e.archiveId}\">Save Cookie files (${cookies.length})</button>` : ''}";
    s=swap(s,oldButton,'','archive header cookie button');
    const topCookie = '${cookies.length ? `<section class="card archive-cookie-card"><div class="archive-cookie-head">${I.lock}<h3>Cookie files <span>${cookies.length}</span></h3></div><div class="archive-cookie-items">${cookies.map((name, i) => `<button class="btn btn-quiet" data-action="archive-cookie-one" data-id="${e.archiveId}" data-name="${esc(name)}">Save Cookie ${i + 1}</button>`).join(\'\')}</div></section>` : \'\'}';
    s=swap(s,topCookie,'','archive separate cookie panel');
    const unresolved = '${view.unresolvedText ? `<details class="card pad archive-unresolved"><summary>Unresolved records</summary><button class="btn" data-action="copy-model" data-source="archive-open" data-field="unresolvedText" data-personal="true">Copy unresolved text</button><pre>${esc(view.unresolvedText)}</pre></details>` : \'\'}';
    s=swap(s,unresolved,'','unresolved panel');
    const buttons = '<div class="archive-column-actions" role="group" aria-label="Copy column">' +
       '${FIELDS.map(([key,label]) => "<button type=\\"button\\" class=\\"btn btn-quiet archive-column-copy\\" data-action=\\"archive-copy-column\\" data-field=\\"" + esc(key) + "\\" aria-label=\\"Copy column " + esc(label) + "\\">" + esc(label) + "</button>").join("")}' +
       '</div>';
    s=swap(s, '<div class="archive-record-list" id="archive-record-list">',buttons+'<div class="archive-record-list" id="archive-record-list">','archive column actions');
    s=swap(s,'function recordCard(row, index) {','function recordCard(row, index, cookieFile) {','recordCard cookie mapping');
    s=swap(s,"recordField(row, index, key, label)).join(", "recordField(row, index, key, label, cookieFile)).join(", 'record field mapping');
    s=swap(s,"recordCard(row, start + index)).join(","recordCard(row, start + index, view.cookieRecordFiles?.[start + index])).join(",'view cookie mapping');
    s=s.replace(/^[\t ]+$/gm,'');
    return s;
  });
  edit('src/js/main.js',s=>{
    s=swap(s,"  if (action === 'archive-cell-copy' || action === 'archive-cell-reveal') {",[
      "  if (action === 'archive-cookie-copy' || action === 'archive-copy-column') {",
      "    const archiveId = state.archiveView?.entry?.archiveId;",
      "    const currentView = state.archiveView;",
      "    if (!archiveId) return;",
      "    try {",
      "      const value = action === 'archive-cookie-copy'",
      "        ? await window.blego.readArchiveCookie({ id: archiveId, index: Number(target.dataset.row) })",
      "        : await window.blego.readArchiveColumn({ id: archiveId, field: target.dataset.field });",
      "      if (state.archiveView !== currentView || state.view !== 'history') return;",
      "      if (value) await copyText(value, target, action === 'archive-cookie-copy' ? 'Cookie copied' : 'Column copied');",
      "    } catch { toast('Could not copy archive data', 'err'); }",
      "    return;",
      "  }",
      "  if (action === 'archive-cell-copy' || action === 'archive-cell-reveal') {"
    ].join('\n'),'archive copy click handlers');
    return s;
  });
  const css='src/css/tz24.css';
  fs.appendFileSync(css, '\n/* TZ30: click-to-copy cookie card and compact column copy controls. */\n.archive-cookie-field {display:flex;align-items:center;width:100%;text-align:left;cursor:pointer;border:1px solid var(--border, #30313c);border-radius:12px;background:transparent;color:inherit;font:inherit;}\n.archive-cookie-field:disabled {opacity:.55;cursor:default;}\n.archive-cookie-field:not(:disabled):hover,.archive-cookie-field:not(:disabled):focus-visible {border-color:var(--accent, #8b80ff);}\n.archive-column-actions {display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;}\n.archive-column-copy {font-size:12px;}\n');
  console.log('TZ30 archive UI complete');
})();
