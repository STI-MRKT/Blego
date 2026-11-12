const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}
let failed = false;
const files = ['electron', 'src', 'shared', 'scripts', 'tests']
  .flatMap((dir) => {
    try {
      return walk(dir);
    } catch {
      return [];
    }
  })
  .filter((f) => /\.(cjs|mjs|js)$/.test(f));
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status) {
    failed = true;
    console.error(r.stderr);
  }
}
const diff = spawnSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log(
  `Syntax checked ${files.length} JavaScript files; git diff --check exit ${diff.status}`
);
process.exitCode = failed || diff.status ? 1 : 0;
