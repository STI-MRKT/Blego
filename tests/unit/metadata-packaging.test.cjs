const { test } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');

test('packaging refuses absent native runtime and foreign host instead of shipping a broken metadata editor', async (t) => {
  const modulePath = require.resolve('../../scripts/metadata-before-pack.cjs');
  const currentArch = process.arch === 'arm64' ? 3 : 1;
  const current = { electronPlatformName: process.platform, arch: currentArch };
  const foreign = {
    electronPlatformName: process.platform === 'darwin' ? 'linux' : 'darwin',
    arch: currentArch
  };

  // The production hook captures execFileSync at module load. Force an absent probe.
  t.mock.method(childProcess, 'execFileSync', () => {
    throw Error('NATIVE_RUNTIME_MISSING_IN_TEST');
  });
  delete require.cache[modulePath];
  try {
    const beforePack = require(modulePath);
    await assert.rejects(beforePack(current), /METADATA_RUNTIME_NOT_VERIFIED/);
    await assert.rejects(beforePack(foreign), /METADATA_RUNTIME_NOT_VERIFIED/);
  } finally {
    t.mock.restoreAll();
    delete require.cache[modulePath];
  }
});
