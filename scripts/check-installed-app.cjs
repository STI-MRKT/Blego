const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
(async () => {
  const args = process.argv.slice(2),
    get = (k) => args[args.indexOf(k) + 1];
  if (!args.includes('--executable') || !args.includes('--report'))
    throw Error('Usage: --executable <installed-path> --report <json>');
  const suite = args.includes('--suite') ? get('--suite') : 'all';
  if (!['all', 'classifier', 'tz14', 'tz15'].includes(suite))
    throw Error('UNKNOWN_INSTALLED_TEST_SUITE');
  const executable = fs.realpathSync(get('--executable')),
    report = path.resolve(get('--report')),
    project = fs.realpathSync(path.resolve(__dirname, '..'));
  if (executable === project || executable.startsWith(project + path.sep))
    throw Error('INSTALLED_APP_MUST_BE_OUTSIDE_CHECKOUT');
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const log = report + '.log';
  const stream = fs.createWriteStream(log, { flags: 'w', mode: 0o600 });
  // TZ14 touches FP/BIO, Friends, Archive, Settings and phone copying.
  // All other GUI modules were already checked against the unchanged PR #18.
  const tz14Tests = [
    'archive-actions',
    'archive-v141',
    'biography-v143',
    'copy-all-sections',
    'friends-bulk-copy',
    'generator-bio',
    'generator-phone-address',
    'generator-picker-tz12',
    'generator-v14',
    'header-copy-removed',
    'news-copy',
    'settings-v14',
    'ux-restoration',
    'classifier-copy'
  ].map((name) => `tests/ui/${name}.test.cjs`);
  const tz15Tests = [
    'app',
    'archive-actions',
    'biography-v143',
    'classifier',
    'classifier-copy',
    'classifier-tz13',
    'classifier-v14',
    'classifier-v142',
    'classifier-v143',
    'copy-all-sections',
    'facebook-flow',
    'facebook-v14',
    'friends-bulk-copy',
    'generator-bio',
    'generator-phone-address',
    'generator-v14',
    'header-copy-removed',
    'news-copy',
    'settings-v14',
    'ux-restoration'
  ].map((name) => `tests/ui/${name}.test.cjs`);
  const tests =
    suite === 'classifier'
      ? require('./classifier-qa-suite.cjs').classifierTests('ui')
      : suite === 'tz14'
        ? tz14Tests
        : suite === 'tz15'
          ? tz15Tests
          : fs
              .readdirSync(path.join(project, 'tests/ui'))
              .filter((name) => name.endsWith('.test.cjs'))
              .sort()
              .map((name) => 'tests/ui/' + name);
  if (tests.some((name) => !fs.existsSync(path.join(project, name))))
    throw Error('MISSING_INSTALLED_APP_TEST');
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
    cwd: project,
    env: {
      ...process.env,
      BLEGO_EXECUTABLE: executable,
      ...(process.platform === 'linux' ? { BLEGO_HEADLESS: '1' } : {})
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  await new Promise((resolve) => stream.end(resolve));
  const result = {
    status: code === 0 ? 'PASS' : 'FAIL',
    code,
    checkedAt: new Date().toISOString(),
    host: `${process.platform}-${process.arch}`,
    osRelease: os.release(),
    executable,
    executableSha256: createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),
    codeSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    suite,
    tests,
    log,
    dataIsolation:
      'Every test supplies its own temporary user-data directory; no default user store',
    scope:
      suite === 'classifier'
        ? 'Actual packaged executable outside checkout: all classifier and archive GUI tests, including TXT/CSV/TSV/JSON import, actual clipboard, manual assignment, export, archive and reset. Synthetic fixtures and controlled dialogs. Unrelated modules are outside this selective run; original customer-file acceptance, signing/notarization and real OS denial cases are separate gates.'
        : suite === 'tz14'
          ? 'Actual installed macOS application: selected FP/BIO, Friends, Archive, Settings, phone-copy and unchanged News/Classifier GUI regressions, native clipboard and persistence. Other unchanged GUI modules have prior baseline acceptance; signing/notarization and customer-file acceptance are separate gates.'
          : suite === 'tz15'
            ? 'Installed BLEGO.app, 20 targeted classifier credentials, archive, copied secrets, News, FB.Tools-only Checker, generator/BIO and unchanged workflow GUI tests; live third-party provider is separately verified; signing/notarization and customer-file acceptance are distinct gates.'
            : 'Actual packaged executable outside checkout: local workflows, native clipboard API, metadata export, groups/reference, saved settings and restart. Dialog choices are controlled test fixtures. Signing/notarization and real OS denial/window-manager cases are separate gates.'
  };
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = code === 0 ? 0 : 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
