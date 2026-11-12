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
  const executable = fs.realpathSync(get('--executable')),
    report = path.resolve(get('--report')),
    project = fs.realpathSync(path.resolve(__dirname, '..'));
  if (executable === project || executable.startsWith(project + path.sep))
    throw Error('INSTALLED_APP_MUST_BE_OUTSIDE_CHECKOUT');
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const log = report + '.log';
  const stream = fs.createWriteStream(log, { flags: 'w', mode: 0o600 });
  const tests = [
    'tests/ui/app.test.cjs',
    'tests/ui/copy-all-sections.test.cjs',
    'tests/ui/image-groups.test.cjs'
  ];
  const child = spawn(process.execPath, ['--test', ...tests], {
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
    tests,
    log,
    dataIsolation:
      'Every test supplies its own temporary user-data directory; no default user store',
    scope:
      'Actual packaged executable outside checkout: local workflows, native clipboard API, metadata export, groups/reference, saved settings and restart. Dialog choices are controlled test fixtures. Signing/notarization and real OS denial/window-manager cases are separate gates.'
  };
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = code === 0 ? 0 : 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
