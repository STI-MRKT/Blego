// Run with the installed Electron executable in Node mode, outside the checkout.
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(process.argv[2] || '');
if (!root.endsWith('app.asar')) throw Error('APP_ASAR_REQUIRED');
const bundled = createRequire(path.join(root, 'package.json'));
for (const dependency of Object.keys(bundled('./package.json').dependencies || {})) {
  const resolved = bundled.resolve(dependency);
  if (!resolved.startsWith(root + path.sep) && !resolved.startsWith(root + '.unpacked' + path.sep))
    throw Error('DEPENDENCY_OUTSIDE_PACKAGE: ' + dependency);
  bundled(dependency);
}
console.log('PASS: production dependencies load from the standalone package');
