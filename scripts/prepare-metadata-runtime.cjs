// Build-time packaging only. The application never downloads an interpreter.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
if (process.platform === 'win32') {
  require.resolve('exiftool-vendored.exe');
  console.log(
    'Using the installed Windows ExifTool package; native execution is checked by integration tests.'
  );
  process.exit(0);
}
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw Error('Provide and verify a platform-specific bundled Perl runtime before packaging');
const version = execFileSync('/usr/bin/perl', ['-e', 'print $^V'], { encoding: 'utf8' }).trim();
if (version !== 'v5.40.1')
  throw Error('Review the installed Perl version and license before rebuilding this runtime');
const root = path.resolve('build/metadata-runtime/linux-x64');
try {
  const previous = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (
    previous.perlVersion === version &&
    previous.files.length &&
    previous.files.every(
      (file) =>
        createHash('sha256')
          .update(fs.readFileSync(path.join(root, file.path)))
          .digest('hex') === file.sha256
    )
  ) {
    console.log(`Verified existing embedded ${version}: ${previous.files.length} files.`);
    process.exit(0);
  }
} catch {
  /* First preparation or incomplete runtime: copy the reviewed build inputs. */
}
fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
fs.mkdirSync(path.join(root, 'licenses'), { recursive: true });
fs.copyFileSync('/usr/bin/perl', path.join(root, 'bin/perl'));
fs.chmodSync(path.join(root, 'bin/perl'), 0o755);
fs.cpSync('/usr/share/perl/5.40.1', path.join(root, 'lib/core'), {
  recursive: true,
  dereference: true
});
fs.cpSync('/usr/lib/x86_64-linux-gnu/perl/5.40.1', path.join(root, 'lib/arch'), {
  recursive: true,
  dereference: true
});
fs.copyFileSync('/usr/share/doc/perl/copyright', path.join(root, 'licenses/perl-copyright.txt'));
fs.copyFileSync('/usr/share/common-licenses/Artistic', path.join(root, 'licenses/Artistic.txt'));
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name !== 'manifest.json')
      files.push({
        path: path.relative(root, file),
        sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      });
  }
}
walk(root);
files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  platform: 'linux-x64',
  perlVersion: version,
  license: 'Artistic (core); bundled component notices in licenses/perl-copyright.txt',
  source:
    'Debian Perl 5.40.1 installed in the Cloud build environment; upstream https://www.cpan.org/src/5.0/',
  files
};
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Prepared embedded ${version}: ${files.length} files; no application-time system Perl lookup.`
);
