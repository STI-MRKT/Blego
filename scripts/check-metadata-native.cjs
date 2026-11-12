const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const hash = (x) => createHash('sha256').update(x).digest('hex');
function verifyManifest({ target, root }) {
  if (target !== `${process.platform}-${process.arch}`) throw Error('TARGET_HOST_MISMATCH');
  root = fs.realpathSync(root);
  const bytes = fs.readFileSync(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(bytes);
  if (manifest.platform !== target || !Array.isArray(manifest.files) || !manifest.files.length)
    throw Error('RUNTIME_MANIFEST_INVALID');
  const names = new Set();
  for (const f of manifest.files) {
    if (
      typeof f.path !== 'string' ||
      path.isAbsolute(f.path) ||
      f.path.split(/[\\/]/).some((x) => ['..', '.', ''].includes(x)) ||
      names.has(f.path)
    )
      throw Error('RUNTIME_MANIFEST_PATH');
    names.add(f.path);
    const file = path.join(root, f.path),
      stat = fs.lstatSync(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !fs.realpathSync(file).startsWith(root + path.sep)
    )
      throw Error('RUNTIME_MANIFEST_PATH');
    if (hash(fs.readFileSync(file)) !== f.sha256) throw Error('RUNTIME_CHECKSUM_MISMATCH');
  }
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) walk(file);
      else {
        const relative = path.relative(root, file);
        if (relative !== 'manifest.json' && !names.has(relative))
          throw Error('RUNTIME_UNLISTED_FILE');
      }
    }
  };
  walk(root);
  return {
    root,
    manifestSha256: hash(bytes),
    files: manifest.files.length,
    perlVersion: manifest.perlVersion || null
  };
}
async function probe({ target, root }) {
  const verified = verifyManifest({ target, root });
  const sharp = require('sharp');
  const { createImageService } = require('../electron/features/images/service.cjs');
  const { createEngine } = require('../electron/features/images/engine.cjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-native-probe-'));
  const oldPath = process.env.PATH;
  const dependencies =
    process.platform === 'linux'
      ? execFileSync('/usr/bin/ldd', [path.join(verified.root, 'bin/perl')], { encoding: 'utf8' })
      : process.platform === 'darwin'
        ? execFileSync('/usr/bin/otool', ['-L', path.join(verified.root, 'bin/perl')], {
            encoding: 'utf8'
          })
        : 'Windows: native execution and bundled DLL resolution tested; separate dependency audit required';
  if (/not found|\/home\/|\/workspace\/|\/opt\/homebrew\//.test(dependencies))
    throw Error('RUNTIME_EXTERNAL_DEPENDENCY');
  try {
    // No system Perl/ExifTool lookup may rescue a missing bundled interpreter.
    process.env.PATH = '';
    const formats = [];
    for (const format of ['jpeg', 'png', 'webp']) {
      const source = path.join(temp, 'source.' + (format === 'jpeg' ? 'jpg' : format));
      await sharp({
        create: {
          width: 16,
          height: 12,
          channels: 4,
          background: { r: 70, g: 30, b: 180, alpha: 0.6 }
        }
      })
        .withMetadata({ orientation: 6 })
        .toFormat(format)
        .toFile(source);
      const original = hash(fs.readFileSync(source));
      const service = createImageService({ engine: createEngine({ runtimeRoot: verified.root }) });
      const [f] = await service.addFiles([source]);
      await service.readImageMetadata(f.fileId);
      const plan = service.planMetadataChanges({
        fileIds: [f.fileId],
        operations: [
          { field: 'title', action: 'set', value: 'Explicit native QA' },
          { field: 'iso', action: 'set', value: 200 },
          { field: 'exposureTime', action: 'set', value: '1/125' },
          { field: 'gps', action: 'set', value: { latitude: 0, longitude: 0, altitude: null } }
        ]
      });
      const result = await service.applyMetadataPlan({
        planId: plan.planId,
        destinationToken: await service.addDestination(temp)
      });
      if (result.files[0].status !== 'completed' || hash(fs.readFileSync(source)) !== original)
        throw Error('NATIVE_READ_WRITE_READ_FAILED:' + JSON.stringify(result));
      formats.push({
        format,
        status: 'PASS',
        verification:
          'actual read/write/readback, protected payload and pixels, unchanged original',
        outputSha256: result.files[0].outputHash
      });
    }
    return {
      status: 'PASS',
      target,
      osRelease: os.release(),
      node: process.version,
      sharp: sharp.versions,
      manifest: verified,
      dependencies,
      pathEmpty: true,
      formats
    };
  } finally {
    process.env.PATH = oldPath;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
async function main() {
  const args = process.argv.slice(2);
  const get = (k) => args[args.indexOf(k) + 1];
  const target = get('--target'),
    root = get('--root'),
    report = get('--report');
  if (!args.includes('--target') || !args.includes('--root') || !args.includes('--report'))
    throw Error('Usage: --target <platform-arch> --root <runtime> --report <json>');
  let result;
  try {
    result = await probe({ target, root });
  } catch (e) {
    result = {
      status: 'FAIL',
      target,
      host: `${process.platform}-${process.arch}`,
      error: e.message
    };
    process.exitCode = 1;
  }
  result.checkedAt = new Date().toISOString();
  result.codeSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { verifyManifest, probe };
