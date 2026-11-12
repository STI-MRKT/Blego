const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const file = process.argv[2];
assert.ok(file, 'Pass the built app.asar path');
const entries = new Set(asar.listPackage(file).map((p) => p.replaceAll('\\', '/')));
for (const required of [
  '/electron/main.cjs',
  '/electron/preload.cjs',
  '/electron/local/store.cjs',
  '/electron/features/classification/worker.cjs',
  '/shared/importer.mjs',
  '/shared/contracts.mjs',
  '/resources/generator/schema.json',
  '/resources/generator/countries/BR.json',
  '/resources/generator/types/crypto.json',
  '/resources/news/examples.json',
  '/src/index.html'
])
  assert.ok(entries.has(required), `Missing packaged resource: ${required}`);
for (const entry of entries) {
  assert.ok(!/^\/(tests|docs|artifacts|release)\//.test(entry), `Non-product resource: ${entry}`);
  assert.ok(!/\.(sqlite|db)(-|$)/.test(entry), `Runtime database included: ${entry}`);
}
const main = asar.extractFile(file, 'electron/main.cjs').toString();
assert.match(main, /createClassificationService\(\)/);
assert.ok(!main.includes('allowTestRules: true'));
console.log(`PASS packaged resources and test/data exclusion (${entries.size} entries)`);
const fs = require('node:fs');
const path = require('node:path');
const project = path.resolve(__dirname, '..');
let matched = 0;
function compare(dir) {
  for (const e of fs.readdirSync(path.join(project, dir), { withFileTypes: true })) {
    const relative = dir + '/' + e.name;
    if (e.isDirectory()) compare(relative);
    else {
      assert.deepEqual(
        asar.extractFile(file, relative),
        fs.readFileSync(path.join(project, relative)),
        `Packaged source differs: ${relative}`
      );
      matched++;
    }
  }
}
for (const dir of ['electron', 'src', 'shared', 'resources']) compare(dir);
console.log(`PASS ${matched} packaged application files match the checkout byte-for-byte`);
