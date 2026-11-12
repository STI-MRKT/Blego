const { test } = require('node:test');
const assert = require('node:assert/strict');
test('packaging refuses absent platform runtime rather than shipping a metadata editor without its engine', async () => {
  const beforePack = require('../../scripts/metadata-before-pack.cjs');
  await assert.rejects(
    beforePack({ electronPlatformName: 'darwin', arch: 3 }),
    /METADATA_RUNTIME_NOT_VERIFIED/
  );
  await assert.rejects(
    beforePack({ electronPlatformName: 'linux', arch: 3 }),
    /METADATA_RUNTIME_NOT_VERIFIED/
  );
  await beforePack({ electronPlatformName: 'linux', arch: 1 });
});
