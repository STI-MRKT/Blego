'use strict';
// Applied only after the staged BLEGO source is reconstructed.
// Preserve the original classifier and unrelated screen styles.
const fs = require('node:fs');

function update(path, callback) {
  const original = fs.readFileSync(path, 'utf8');
  const changed = callback(original);
  if (changed !== original) fs.writeFileSync(path, changed);
}
function once(source, needle, replacement, label) {
  if (source.split(needle).length !== 2) throw Error('TZ36_' + label + '_ANCHOR');
  return source.replace(needle, replacement);
}

update('shared/classifier-structure.mjs', (source) => {
  if (source.includes('const ownedProfile = (profileIndex, cookieIndex) =>')) return source;
  const snippet = fs.readFileSync('scripts/tz36-structure-snippet.txt', 'utf8');
  const anchor = '  if (!anchored || entries.length < 5) return roles;';
  return once(source, anchor, snippet + '\n' + anchor, 'STRUCTURE');
});

update('shared/classifier-lexer.mjs', (source) => {
  if (source.includes('const mailboxTuple =')) return source;
  const snippet = fs.readFileSync('scripts/tz36-lexer-snippet.txt', 'utf8');
  source = once(source, '    const extra =', snippet + '    const extra =', 'MAIL_LEXER');
  const needle = [
    '      ((nextLabel &&',
    '        !fieldForHeader(current.trim()) &&',
    "        (!composite || /\\s/.test(text[i - 1] || '') || completedFacebookId || completedUA)) ||"
  ].join('\n');
  const replacement = [
    '      (mailboxTuple ||',
    '        (nextLabel &&',
    '          !fieldForHeader(current.trim()) &&',
    "          (!composite || /\\s/.test(text[i - 1] || '') || completedFacebookId || completedUA)) ||"
  ].join('\n');
  return once(source, needle, replacement, 'MAIL_DELIMITER');
});

update('src/js/ui/import.js', (source) => {
  const oldFields = 'const UI_FIELDS = CLASSIFIER_FIELDS.map(f => ({...f,label:CLASSIFIER_UI_LABELS[f.key] || f.key}));';
  const fields = [
    'const UI_FIELDS = CLASSIFIER_FIELDS.flatMap(f => {',
    '  const cell = {...f,label:CLASSIFIER_UI_LABELS[f.key] || f.key};',
    "  return f.key === 'emailPassword' ? [cell,{key:'twoFactorCode',label:'2FA'}] : [cell];",
    '});'
  ].join('\n');
  source = once(source, oldFields, fields, 'UI_FIELDS');
  source = once(
    source,
    "  const raw = record.data[field.key] || '';",
    "  const raw = record.data[field.key] ?? record.extended?.[field.key] ?? '';",
    'EXTENDED_VALUE'
  );
  const cell = [
    "  if (field.key === 'twoFactorCode') {",
    "    const revealed = state.classifierRevealed?.['2fa:' + record.id] === true;",
    "    const value = raw ? (revealed ? esc(raw) : '••••••••') : '';",
    "    return '<td class=\"classifier-2fa-cell\"><span class=\"classifier-value mono\">' + value + '</span>' +",
    "      (raw ? '<button type=\"button\" class=\"btn btn-quiet classifier-2fa-reveal\" data-action=\"classifier-2fa-reveal\" data-row=\"' + esc(record.id) + '\">' + (revealed ? 'Скрыть' : 'Показать') + '</button>' : '') +",
    "      '<button type=\"button\" class=\"copy\" data-action=\"classifier-copy-cell\" data-row=\"' + esc(record.id) + '\" data-field=\"twoFactorCode\" aria-label=\"Копировать 2FA\" ' + (!raw ? 'disabled' : '') + '>' + I.copy + '</button></td>';",
    '  }'
  ].join('\n');
  source = once(source, "  if (field.key === 'rowNumber') return", cell + "\n  if (field.key === 'rowNumber') return", 'MASKED_2FA');
  source = once(
    source,
    "const labels=[...UI_FIELDS.slice(1),...Object.entries(extraLabels).map(([key,label])=>({key,label}))];",
    "const labels=[...UI_FIELDS.slice(1),...Object.entries(extraLabels).filter(([key])=>key!=='twoFactorCode').map(([key,label])=>({key,label}))];",
    'DETAIL_2FA_DEDUP'
  );
  // Remove only the redundant toolbar, not the column copy buttons in <th>.
  const start = source.indexOf('  <div class="head-actions classifier-bulk-copy"');
  const end = start >= 0 ? source.indexOf('  </div>\n', start) : -1;
  if (start < 0 || end < 0 || source.indexOf('classifier-copy-column-button', start) > end)
    throw Error('TZ36_BULK_TOOLBAR_ANCHOR');
  source = source.slice(0, start) + source.slice(end + '  </div>\n'.length);
  return source;
});

update('src/js/main.js', (source) => {
  source = once(
    source,
    "'userAgent','backupEmail']);",
    "'userAgent','backupEmail','twoFactorCode']);",
    'BULK_COPY_2FA'
  );
  const action = [
    "  if (action === 'classifier-2fa-reveal') {",
    '    const recordId = target.dataset.row;',
    '    if (!recordId || !state.importData?.records?.some(r => r.id === recordId)) return;',
    '    state.classifierRevealed ||= {};',
    "    const key = '2fa:' + recordId;",
    '    state.classifierRevealed[key] = !state.classifierRevealed[key];',
    '    renderView();',
    '    return;',
    '  }'
  ].join('\n');
  source = once(source, "  if (action === 'classifier-reveal') {", action + "\n  if (action === 'classifier-reveal') {", '2FA_TOGGLE');
  return source;
});

const css = [
  '',
  '/* TZ36: only the classifier; visible header-copy controls and roomy table layout. */',
  '.classifier-page .classifier-table th, .classifier-page .classifier-table td {padding:14px 20px;line-height:1.5;}',
  '.classifier-page .classifier-table th {white-space:nowrap;}',
  '.classifier-page .classifier-table .classifier-column-copy {display:inline-flex!important;opacity:1!important;visibility:visible!important;align-items:center;justify-content:center;width:26px;height:26px;margin-left:14px;padding:0;border-radius:7px;border:1px solid var(--border);background:var(--panel);color:var(--muted);vertical-align:middle;cursor:pointer;}',
  '.classifier-page .classifier-table .classifier-column-copy svg {width:14px;height:14px;}',
  '.classifier-page .classifier-table .classifier-column-copy:hover,.classifier-page .classifier-table .classifier-column-copy:focus-visible {color:var(--accent);border-color:var(--accent-ring);background:var(--accent-soft);}',
  '.classifier-page .classifier-table td .copy {margin-left:12px;}',
  '.classifier-page .classifier-table .classifier-value {max-width:210px;}',
  '.classifier-page .classifier-table .classifier-2fa-cell .classifier-2fa-reveal {margin-left:12px;min-height:28px;padding:0 10px;}',
  '.classifier-page .classifier-table .classifier-2fa-cell .copy {margin-left:10px;}',
  '.classifier-page .classifier-quick-actions {margin-bottom:18px;}',
  '@media (max-width:700px) {.classifier-page .classifier-table th,.classifier-page .classifier-table td{padding:12px 14px;}.classifier-page .classifier-table .classifier-column-copy{margin-left:10px;}}',
  ''
].join('\n');
const cssPath='src/css/tz24.css';
if (!fs.existsSync(cssPath)) throw Error('TZ36_TZ24_CSS_NOT_RESTORED');
const current = fs.readFileSync(cssPath, 'utf8');
if (!current.includes('TZ36: only the classifier')) fs.appendFileSync(cssPath, css);
console.log('TZ36 UI: toolbar hidden, header icons visible, wider column spacing and masked 2FA field');
