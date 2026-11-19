'use strict';
// Electron CLI switches must precede the app entry point. The previous GUI fixtures
// put --user-data-dir after ".", so Electron ignored it and all tests shared one
// persistent profile. This caused cross-test contamination despite process isolation.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../tests/ui');
let scanned = 0;
let moved = 0;
const unresolved = [];
for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.test.cjs')).sort()) {
  const file = path.join(dir, name);
  const before = fs.readFileSync(file, 'utf8');
  const lines = before.split(/\r?\n/);
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("...(process.env.BLEGO_EXECUTABLE ? [] : ['.'])")) continue;
    scanned++;
    let found = -1;
    for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
      if (lines[j].includes('--user-data-dir=')) {
        found = j;
        break;
      }
      if (lines[j].includes(']') && !lines[j].includes('\`')) break;
    }
    if (found >= 0) {
      let [userData] = lines.splice(found, 1);
      if (!userData.trimEnd().endsWith(',')) userData = userData.trimEnd() + ',';
      lines.splice(i, 0, userData);
      moved++;
      changed = true;
      i++;
    } else {
      const prior = lines.slice(Math.max(0, i - 6), i).some((line) => line.includes('--user-data-dir='));
      if (!prior) unresolved.push(name + ':' + (i + 1));
    }
  }
  if (changed) fs.writeFileSync(file, lines.join('\n'));
}
if (unresolved.length) {
  throw new Error('Unresolved Electron user-data-dir ordering: ' + unresolved.join(', '));
}
console.log('TZ32_ELECTRON_TEST_ISOLATION', JSON.stringify({ scannedLaunches: scanned, movedFlags: moved }));
