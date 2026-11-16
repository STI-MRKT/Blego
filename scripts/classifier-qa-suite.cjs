// One explicit scope shared by source and installed-app TZ13 acceptance.
// The default installed-app runner still selects its complete GUI suite.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function classifierTests(kind) {
  if (!['unit', 'integration', 'ui'].includes(kind)) throw Error('UNKNOWN_TEST_KIND');
  return fs
    .readdirSync(path.resolve(__dirname, '../tests', kind))
    .filter(
      (name) =>
        name.endsWith('.test.cjs') &&
        (/^(classifier|archive)(?:[.-])/.test(name) || name === 'importer.test.cjs')
    )
    .sort()
    .map((name) => `tests/${kind}/${name}`);
}

module.exports = { classifierTests };
if (require.main === module) {
  const tests = [...classifierTests('unit'), ...classifierTests('integration')];
  console.log('TZ13 source acceptance scope: ' + tests.join(', '));
  const result = spawnSync(process.execPath, ['--test', ...tests], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  process.exitCode = result.status === 0 ? 0 : 1;
}
