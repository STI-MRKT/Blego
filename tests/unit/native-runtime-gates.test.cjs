const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
test('native gate rejects foreign host, unsafe manifest entries and changed runtime bytes', async (t) => {
  const { verifyManifest } = require('../../scripts/check-metadata-native.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-native-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(
    () =>
      verifyManifest({
        target: process.platform === 'darwin' ? 'linux-x64' : 'darwin-arm64',
        root
      }),
    /TARGET_HOST_MISMATCH/
  );
  const target = `${process.platform}-${process.arch}`;
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({ platform: target, files: [{ path: '../outside', sha256: '0'.repeat(64) }] })
  );
  assert.throws(() => verifyManifest({ target, root }), /MANIFEST_PATH/);
  fs.writeFileSync(path.join(root, 'runtime'), 'changed');
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    JSON.stringify({ platform: target, files: [{ path: 'runtime', sha256: '0'.repeat(64) }] })
  );
  assert.throws(() => verifyManifest({ target, root }), /CHECKSUM/);
});
