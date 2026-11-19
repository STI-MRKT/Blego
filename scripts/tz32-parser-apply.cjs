(function apply() {
  const fs=require('node:fs'),p='shared/importer.mjs';
  let s=fs.readFileSync(p,'utf8');
  function repl(a,b,id){if(!s.includes(a))throw Error('TZ32 importer anchor missing '+id);s=s.replace(a,b);}
  repl("import { tabLabelRecords } from './classifier-tab-labels.mjs';",
       "import { tabLabelRecords } from './classifier-tab-labels.mjs';\nimport { shopReceiptRecords } from './classifier-shop-receipt.mjs';",
       "special receipt import");
  const where = "  let structured = false;\n  const vertical =";
  repl(where,
    "  let structured = false;\n  const shop = format === 'txt' && options.classification && !options.schema && options.headers !== true\n    ? shopReceiptRecords(text) : null;\n  const vertical =",
    "shop detector");
  repl("    !receipt.receipt\n      ? verticalAccountRecords(text)",
       "    !receipt.receipt && !shop\n      ? verticalAccountRecords(text)",
       "skip generic vertical on shop receipt");
  repl("  if (vertical) {",
       "  if (shop) {\n    ({ records, columns, delimiter, headerless, structured } = shop);\n    diagnostics.push(...shop.diagnostics);\n  } else if (vertical) {",
       "receipt precedence");
  fs.writeFileSync(p,s);
  console.log('TZ32 classifier: specific English receipt before generic TXT lexer');
})();
