(function apply() {
  const fs = require('node:fs'), p = 'shared/importer.mjs';
  let s = fs.readFileSync(p, 'utf8');
  function repl(a, b, id) {
    if (!s.includes(a)) throw Error('TZ33 importer anchor missing ' + id);
    s = s.replace(a, b);
  }

  const importLine = "import { tabLabelRecords } from './classifier-tab-labels.mjs';";
  if (!s.includes("import { shopReceiptRecords } from './classifier-shop-receipt.mjs';")) {
    repl(importLine, importLine + "\nimport { shopReceiptRecords } from './classifier-shop-receipt.mjs';", 'localized receipt import');
  }

  const receiptBlock = [
    '  const sourceText = text;',
    '  const receipt =',
    "    format === 'txt' && options.classification && options.headers !== true",
    '      ? receiptPayload(text)',
    '      : { text, receipt: false };'
  ].join('\n');
  const localizedReceiptBlock = [
    '  const sourceText = text;',
    "  const shop = format === 'txt' && options.classification && !options.schema && options.headers !== true",
    '    ? shopReceiptRecords(text) : null;',
    '  const receipt = shop',
    '    ? { text, receipt: true }',
    "    : format === 'txt' && options.classification && options.headers !== true",
    '      ? receiptPayload(text)',
    '      : { text, receipt: false };'
  ].join('\n');
  if (s.includes(receiptBlock)) {
    repl(receiptBlock, localizedReceiptBlock, 'detect localized shop receipt before generic masking');
  } else if (!s.includes('  const shop = format ===')) {
    throw Error('TZ33 importer anchor missing receipt block');
  }

  // Do not redeclare shop after receiptPayload; it must inspect the original,
  // unmasked text so translated section headings remain available.
  const oldWhere = '  let structured = false;\n  const shop = format === \'txt\' && options.classification && !options.schema && options.headers !== true\n    ? shopReceiptRecords(text) : null;\n  const vertical =';
  const newWhere = '  let structured = false;\n  const vertical =';
  if (s.includes(oldWhere)) repl(oldWhere, newWhere, 'remove late shop detection');
  else if (!s.includes(newWhere)) throw Error('TZ33 importer anchor missing vertical parser');

  const oldVertical = '    !receipt.receipt\n      ? verticalAccountRecords(text)';
  const newVertical = '    !receipt.receipt && !shop\n      ? verticalAccountRecords(text)';
  if (s.includes(oldVertical)) repl(oldVertical, newVertical, 'skip generic vertical parser for localized receipt');
  else if (!s.includes(newVertical)) throw Error('TZ33 importer anchor missing vertical guard');

  const oldBranch = '  if (encoded) {';
  const newBranch = [
    '  if (shop) {',
    '    ({ records, columns, delimiter, headerless, structured } = shop);',
    '    diagnostics.push(...shop.diagnostics);',
    '  } else if (encoded) {'
  ].join('\n');
  if (s.includes(oldBranch)) repl(oldBranch, newBranch, 'localized receipt takes precedence over generic text parsers');
  else if (!s.includes('  if (shop) {')) throw Error('TZ33 importer anchor missing encoded branch');

  fs.writeFileSync(p, s);
  console.log('TZ33 classifier: multilingual receipt detection precedes generic receipt masking and TXT lexers');
})();
