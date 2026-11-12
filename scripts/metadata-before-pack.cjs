const fs = require('node:fs');
const path = require('node:path');
module.exports = async function beforePack(context) {
  if (context.electronPlatformName === 'linux' && context.arch === 1) {
    const root = path.resolve('build/metadata-runtime/linux-x64');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    if (manifest.platform !== 'linux-x64' || !fs.existsSync(path.join(root, 'bin/perl')))
      throw Error('METADATA_RUNTIME_NOT_VERIFIED: prepare the bundled Linux interpreter');
    require.resolve('sharp');
    require.resolve('exiftool-vendored.pl');
    return;
  }
  // Do not silently ship cross-built installers whose metadata engine cannot run.
  throw Error(
    `METADATA_RUNTIME_NOT_VERIFIED: ${context.electronPlatformName}/${context.arch}; supply and run the bundled engine on this target before enabling packaging`
  );
};
