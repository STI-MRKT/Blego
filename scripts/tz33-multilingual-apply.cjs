'use strict';
const fs = require('node:fs');

const importerPath = 'shared/importer.mjs';
let importer = fs.readFileSync(importerPath, 'utf8');
if (!importer.includes("import { shopReceiptRecords } from './classifier-shop-receipt.mjs';")) {
  throw new Error('TZ33_SHOP_RECEIPT_IMPORT_MISSING');
}

const oldAllowlist = "  if (!['utf-8', 'utf-16le', 'utf-16be', 'windows-1251'].includes(encoding))\n    throw failure('UNSUPPORTED_ENCODING', 'read');";
const newAllowlist = [
  "  const encodingAliases = new Map([",
  "    ['utf8', 'utf-8'], ['cp1250', 'windows-1250'], ['cp1251', 'windows-1251'],",
  "    ['cp1252', 'windows-1252'], ['latin2', 'iso-8859-2'], ['gbk', 'gb18030'], ['gb2312', 'gb18030']",
  "  ]);",
  "  encoding = encodingAliases.get(String(encoding).toLowerCase()) || String(encoding).toLowerCase();",
  "  const supportedEncodings = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1250', 'windows-1251', 'windows-1252', 'iso-8859-2', 'gb18030', 'big5'];",
  "  if (!supportedEncodings.includes(encoding)) throw failure('UNSUPPORTED_ENCODING', 'read');"
].join('\n');
if (importer.includes(oldAllowlist)) importer = importer.replace(oldAllowlist, newAllowlist);
else if (!importer.includes('const supportedEncodings =')) throw new Error('TZ33_ENCODING_ALLOWLIST_ANCHOR_MISSING');

const oldDecodeBlock = [
  '  let text;',
  '  try {',
  '    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);',
  '  } catch {',
  "    if (!assumed || !options.classification || encoding !== 'utf-8')",
  "      throw failure('INVALID_ENCODING', 'read');",
  "    const candidate = new TextDecoder('windows-1251', { fatal: true }).decode(bytes);",
  '    // Single-byte encodings cannot be identified universally. Only accept a',
  '    // Cyrillic structured record; keep diagnostics and manual post-import override.',
  '    if (',
  '      !/[А-Яа-яЁё]{3}/u.test(candidate) ||',
  '      !/(?:^|[|\\n])\\s*(?:id|email|name|фио|почта)[:=]/iu.test(candidate) ||',
  '      /[\\u0000-\\u0008\\u000e-\\u001f]/u.test(candidate)',
  '    )',
  "      throw failure('INVALID_ENCODING', 'read');",
  "    encoding = 'windows-1251';",
  '    text = candidate;',
  '  }'
].join('\n');

const newDecodeBlock = [
  '  let text;',
  '  try {',
  '    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);',
  '  } catch {',
  "    if (!assumed || !options.classification || encoding !== 'utf-8')",
  "      throw failure('INVALID_ENCODING', 'read');",
  '    const compatibleEncodings = {',
  "      ru: ['windows-1251'], uk: ['windows-1251'],",
  "      de: ['windows-1250', 'windows-1252'],",
  "      pl: ['windows-1250', 'iso-8859-2'], cs: ['windows-1250', 'iso-8859-2'],",
  "      zh: ['gb18030', 'big5']",
  '    };',
  "    const candidates = ['windows-1250', 'iso-8859-2', 'windows-1251', 'windows-1252', 'gb18030', 'big5'];",
  '    let detected = null;',
  '    for (const candidateEncoding of candidates) {',
  '      let candidate;',
  '      try { candidate = new TextDecoder(candidateEncoding, { fatal: true }).decode(bytes); }',
  '      catch { continue; }',
  '      const receipt = shopReceiptRecords(candidate);',
  '      if (!receipt) continue;',
  '      if (!(compatibleEncodings[receipt.receiptLanguage] || []).includes(candidateEncoding)) continue;',
  '      detected = { encoding: candidateEncoding, text: candidate };',
  '      break;',
  '    }',
  '    if (detected) {',
  '      encoding = detected.encoding;',
  '      text = detected.text;',
  '    } else {',
  "      const legacyCyrillic = new TextDecoder('windows-1251', { fatal: true }).decode(bytes);",
  '      // Preserve the existing generic CP1251 fallback for clearly labelled',
  '      // Cyrillic account files; receipt decoding itself requires a locale match.',
  '      if (',
  '        /[А-Яа-яЁё]{3}/u.test(legacyCyrillic) &&',
  '        /(?:^|[|\\n])\\s*(?:id|email|name|фио|почта)[:=]/iu.test(legacyCyrillic) &&',
  '        !/[\\u0000-\\u0008\\u000e-\\u001f]/u.test(legacyCyrillic)',
  '      ) {',
  "        encoding = 'windows-1251';",
  '        text = legacyCyrillic;',
  '      } else throw failure(\'INVALID_ENCODING\', \'read\');',
  '    }',
  '  }'
].join('\n');

if (importer.includes(oldDecodeBlock)) importer = importer.replace(oldDecodeBlock, newDecodeBlock);
else if (!importer.includes('const compatibleEncodings =')) throw new Error('TZ33_ENCODING_DETECTOR_ANCHOR_MISSING');

fs.writeFileSync(importerPath, importer);
console.log('TZ33 encoding support: UTF-8/UTF-16 plus CP1250/1251/1252, ISO-8859-2, GB18030 and Big5 receipt-aware detection');

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (pkg.version === '1.4.15') {
  pkg.version = '1.4.16';
  lock.version = '1.4.16';
  if (lock.packages?.['']) lock.packages[''].version = '1.4.16';
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
} else if (pkg.version !== '1.4.16') {
  throw new Error('TZ33_EXPECTED_VERSION_1_4_15_GOT_' + pkg.version);
}
