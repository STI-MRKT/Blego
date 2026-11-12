const path = require('node:path');
const { execFileSync } = require('node:child_process');
module.exports = async function beforePack(context) {
  const arch = { 1: 'x64', 3: 'arm64' }[context.arch];
  const target = `${context.electronPlatformName}-${arch}`;
  if (
    target !== `${process.platform}-${process.arch}` ||
    !['linux-x64', 'darwin-arm64', 'darwin-x64', 'win32-x64'].includes(target)
  )
    throw Error(`METADATA_RUNTIME_NOT_VERIFIED: ${target}; native host required`);
  // Fresh real target probe, never a skip flag or a trusted editable PASS report.
  try {
    execFileSync(
      process.execPath,
      [
        path.resolve(__dirname, 'check-metadata-native.cjs'),
        '--target',
        target,
        '--root',
        path.resolve('build/metadata-runtime', target),
        '--report',
        path.resolve('release', `native-runtime-${target}.json`)
      ],
      { stdio: 'pipe', timeout: 240000 }
    );
  } catch {
    throw Error(
      `METADATA_RUNTIME_NOT_VERIFIED: ${target}; inspect native runtime report; packaging blocked`
    );
  }
};
