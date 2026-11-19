(function applyTZ31ColumnCopy() {
  'use strict';
  const fs = require('node:fs');
  const patch = (path, transform) => {
    const before = fs.readFileSync(path, 'utf8');
    const after = transform(before);
    if (before === after) throw new Error('TZ31 no changes in ' + path);
    fs.writeFileSync(path, after);
    console.log('TZ31 patched', path);
  };
  const requireReplace = (text, oldValue, newValue, label) => {
    if (!text.includes(oldValue)) throw new Error('TZ31 missing source anchor: ' + label);
    return text.replace(oldValue, newValue);
  };
  patch('src/js/ui/import.js', (s) => {
    const anchor = '  <div class="table-wrap"><table class="tbl classifier-table">';
    const toolbar = `
  <div class="head-actions classifier-bulk-copy" role="group" aria-label="Массовое копирование столбцов">
    <label class="fl classifier-bulk-select">Столбец
      <select class="input" id="classifier-copy-field" aria-label="Выбрать столбец для копирования">\${UI_FIELDS.filter(f => f.key !== 'rowNumber').map(f => '<option value="' + esc(f.key) + '"' + ((state.classifierBulkField || 'fullName') === f.key ? ' selected' : '') + '>' + esc(f.label) + '</option>').join('')}</select>
    </label>
    <button type="button" class="btn btn-primary classifier-bulk-button" id="classifier-copy-column-button" data-action="classifier-copy-column">Копировать весь столбец</button>
    <span class="sub classifier-bulk-count">Все \${p.filteredTotal} записей\${state.classifierQuery || state.classifierWarningsOnly ? ' с учётом фильтра' : ''}, включая другие страницы</span>
  </div>
`;
    return requireReplace(s, anchor, toolbar + anchor, 'bulk copy toolbar above table');
  });
  patch('src/js/main.js', (s) => {
    const handler = "  if (action === 'classifier-copy-column') {\n    const operationId = state.importData?.operationId, epoch = state.importEpoch;\n    const field = target.dataset.field;";
    const replacement = "  if (action === 'classifier-copy-column') {\n    const operationId = state.importData?.operationId, epoch = state.importEpoch;\n    const field = target.dataset.field || document.getElementById('classifier-copy-field')?.value;";
    s = requireReplace(s, handler, replacement, 'bulk column handler accepts toolbar field');
    s = requireReplace(s,
      "'geo','cookies','token','userAgent']);",
      "'geo','cookies','token','userAgent','backupEmail']);",
      'include backupEmail in supported column fields'
    );
    const progress = '    target.disabled = true;\n    try {\n      for (let offset = 0; ; offset += 50) {';
    s = requireReplace(s, progress, [
      '    target.disabled = true;',
      "    const oldLabel = target.id === 'classifier-copy-column-button' ? target.textContent : null;",
      "    if (oldLabel !== null) target.textContent = 'Копирование…';",
      '    try {',
      '      for (let offset = 0; ; offset += 50) {'
    ].join('\n'), 'bulk copy progress status');
    s = requireReplace(s,
      "      else await copyText(values.join('\\n'), target, 'Column copied');",
      "      else await copyText(values.join('\\n'), target, `Скопировано ${values.length} значений`);",
      'bulk copy confirmation count'
    );
    s = requireReplace(s,
      '    finally { if (target.isConnected) target.disabled = false; }\n    return;',
      [
        '    finally {',
        '      if (target.isConnected) {',
        '        target.disabled = false;',
        '        if (oldLabel !== null) target.textContent = oldLabel;',
        '      }',
        '    }',
        '    return;'
      ].join('\n'),
      'restore bulk copy button'
    );
    const listenerAnchor = "  const sort = document.getElementById('classifier-sort');";
    const listener = "  const copyField = document.getElementById('classifier-copy-field');\n  if (copyField) copyField.onchange = () => { state.classifierBulkField = copyField.value; };\n";
    return requireReplace(s, listenerAnchor, listener + listenerAnchor, 'remember bulk field selection');
  });
  fs.appendFileSync('src/css/tz24.css', [
    '',
    '/* TZ31: readily discoverable whole-column copy next to the classifier table. */',
    '.classifier-bulk-copy {align-items:end;flex-wrap:wrap;gap:10px;margin:12px 0 10px;}',
    '.classifier-bulk-select {min-width:190px;max-width:270px;flex:1 1 190px;}',
    '.classifier-bulk-select select {width:100%;}',
    '.classifier-bulk-button {min-height:38px;white-space:nowrap;}',
    '.classifier-bulk-count {flex:1 1 200px;align-self:center;}',
    '@media(max-width:600px){.classifier-bulk-button{flex:1 1 100%;}}',
    ''
  ].join('\n'));
  console.log('TZ31 bulk classifier column copy toolbar ready');
})();
