const { parentPort, workerData } = require('node:worker_threads');
const { validateBoundary, generatePoints } = require('./geometry.cjs');
const { validatePackage } = require('./catalog.cjs');
try {
  const value =
    workerData.kind === 'package'
      ? validatePackage(JSON.parse(Buffer.from(workerData.bytes).toString('utf8')))
      : generatePoints(validateBoundary(workerData.geometry), workerData.count, {
          exclude: workerData.exclude
        });
  parentPort.postMessage({ ok: true, value });
} catch (e) {
  parentPort.postMessage({
    ok: false,
    code: /^(GEO_[A-Z_]+|CANCELLED)$/.test(e.code || '') ? e.code : 'GEO_INVALID_CATALOG'
  });
}
