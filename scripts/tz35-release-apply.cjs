'use strict';
const fs = require('node:fs');

const source = 'shared/classifier-structure.mjs';
let code = fs.readFileSync(source, 'utf8');
const anchor = `  const anchored =
    emails.length >= 1 &&
    emails.length <= 2 &&
    dates.length === 1 &&
    ids.length === 1 &&
    names.length === 1;`;
const replacement = `  // Some verified order receipts omit the name entirely. In that case,
  // require a matching Cookie owner plus the same email appearing twice in
  // this record before inferring any unlabelled credential.
  const verifiedReceiptWithoutName =
    names.length === 0 &&
    owners.length === 1 &&
    ownerMatches.length === 1 &&
    emails.length === 2 &&
    recognized[emails[0]].value.toLowerCase() === recognized[emails[1]].value.toLowerCase();
  const anchored =
    emails.length >= 1 &&
    emails.length <= 2 &&
    dates.length === 1 &&
    ids.length === 1 &&
    (names.length === 1 || verifiedReceiptWithoutName);`;
const nameLine = "  roles.set(names[0], 'fullName');";
if (code.includes(anchor)) {
  if (code.split(anchor).length !== 2 || code.split(nameLine).length !== 2)
    throw Error('TZ35_STRUCTURE_ANCHOR_AMBIGUOUS');
  code = code.replace(anchor, replacement).replace(nameLine, "  if (names.length === 1) roles.set(names[0], 'fullName');");
  fs.writeFileSync(source, code);
  console.log('TZ35: optional FIO for cookie-verified receipt records');
} else if (code.includes('const verifiedReceiptWithoutName =') && code.includes('if (names.length === 1) roles.set(names[0]')) {
  console.log('TZ35: optional FIO fix already present');
} else {
  throw Error('TZ35_STRUCTURE_ANCHOR_MISSING');
}

// The classifier's bulk-copy handler is materialized by TZ30/TZ31 scripts.
// Make sure it preserves one clipboard line per filtered record, even for
// empty password, name or backup-email fields.
const bulk = fs.readFileSync('src/js/main.js', 'utf8');
if (!bulk.includes("for (const value of full) values.push(value == null ? '' : String(value));") ||
    bulk.includes('if (value !== undefined && value !== null && String(value).length) values.push')) {
  throw Error('TZ35_EMPTY_COLUMN_ALIGNMENT_MISSING');
}

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (pkg.version === '1.4.17') {
  pkg.version = '1.4.18';
  lock.version = '1.4.18';
  if (lock.packages?.['']) lock.packages[''].version = '1.4.18';
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
} else if (pkg.version !== '1.4.18') {
  throw Error('TZ35_EXPECTED_VERSION_1_4_17_GOT_' + pkg.version);
}
