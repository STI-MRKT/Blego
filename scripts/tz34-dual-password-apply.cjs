'use strict';
const fs = require('node:fs');

const source = 'shared/classifier-structure.mjs';
let code = fs.readFileSync(source, 'utf8');
const anchor = '  const ids = [...new Set([...labelledIds, ...looseIds])];';
const replacement = `  const rawIds = [...new Set([...labelledIds, ...looseIds])];
  // Business-profile IDs in receipts are not account IDs. Only a unique
  // matching Cookie c_user owner can disambiguate the account identity.
  const owners = [...new Set(recognized.flatMap((r) => r.cookie?.owners || []))];
  const ownerMatches =
    owners.length === 1
      ? rawIds.filter(
          (i) => (recognized[i].key === 'accountId' ? recognized[i].value : values[i]) === owners[0]
        )
      : [];
  const ids = ownerMatches.length === 1 ? ownerMatches : rawIds;`;

if (code.includes(anchor)) {
  if (code.split(anchor).length !== 2) throw Error('TZ34_DUPLICATE_STRUCTURE_ANCHOR');
  code = code.replace(anchor, replacement);
  fs.writeFileSync(source, code);
  console.log('TZ34: Cookie-owned account ID selected, unrelated business IDs ignored');
} else if (
  code.includes('const rawIds = [...new Set([...labelledIds, ...looseIds])];') &&
  code.includes('const ids = ownerMatches.length === 1 ? ownerMatches : rawIds;')
) {
  console.log('TZ34: dual-password account-owner fix already present');
} else {
  throw Error('TZ34_CLASSIFIER_STRUCTURE_ANCHOR_MISSING');
}

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (pkg.version === '1.4.16') {
  pkg.version = '1.4.17';
  lock.version = '1.4.17';
  if (lock.packages?.['']) lock.packages[''].version = '1.4.17';
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
} else if (pkg.version !== '1.4.17') {
  throw Error('TZ34_EXPECTED_VERSION_1_4_16_GOT_' + pkg.version);
}
