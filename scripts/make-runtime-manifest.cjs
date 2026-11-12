// Write or verify a complete, checksummed native macOS Perl runtime.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(process.argv[2] || '');
const target = process.argv[3];
const verify = process.argv[4] === '--verify';
if (target !== process.platform + '-' + process.arch || !root || !fs.statSync(root).isDirectory())
  throw Error('RUNTIME_HOST_OR_ROOT_MISMATCH');

const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Error('RUNTIME_SYMLINK_REJECTED');
    if (stat.isDirectory()) {
      walk(full);
    } else if (stat.isFile() && rel !== 'manifest.json') {
      files.push({ path: rel, sha256: digest(full) });
    } else if (!stat.isFile()) {
      throw Error('RUNTIME_NONFILE_REJECTED');
    }
  }
}
walk(root);
files.sort((a, b) => a.path.localeCompare(b.path));

if (
  !files.length ||
  !files.some((x) => x.path === 'bin/perl') ||
  !files.some((x) => x.path.startsWith('lib/core/')) ||
  !files.some((x) => x.path.startsWith('lib/arch/'))
)
  throw Error('RUNTIME_INCOMPLETE');

const manifest = {
  platform: target,
  perlVersion: 'v5.40.1',
  source: 'https://www.cpan.org/src/5.0/perl-5.40.1.tar.gz',
  sourceSha256: '02f8c45bb379ed0c3de7514fad48c714fd46be8f0b536bfd5320050165a1ee26',
  license: 'Artistic or GPL; see licenses',
  files
};
if (verify) {
  const current = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (JSON.stringify(current) !== JSON.stringify(manifest)) throw Error('RUNTIME_MANIFEST_CHANGED');
  process.stdout.write('Existing Mac Perl manifest verified: ' + files.length + ' files\n');
} else {
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write('Prepared Mac Perl manifest: ' + files.length + ' files\n');
}
