const { parentPort, workerData } = require('node:worker_threads');
const { validateBoundary, generatePoints, contains } = require('./geometry.cjs');
const { validatePackage } = require('./catalog.cjs');
try {
  let value;
  if (workerData.kind === 'package')
    value = validatePackage(JSON.parse(Buffer.from(workerData.bytes).toString('utf8')));
  else {
    const boundary = validateBoundary(workerData.geometry);
    if (workerData.kind === 'boundary') value = workerData.geometry;
    else if (workerData.kind === 'point') {
      const p = workerData.point;
      if (
        !p ||
        !Number.isFinite(p.latitude) ||
        !Number.isFinite(p.longitude) ||
        Math.abs(p.latitude) > 90 ||
        Math.abs(p.longitude) > 180
      )
        throw Object.assign(Error('GEO_INVALID_REQUEST'), { code: 'GEO_INVALID_REQUEST' });
      value = {
        latitude: Number(p.latitude.toFixed(7)),
        longitude: Number(p.longitude.toFixed(7))
      };
      if (!contains(boundary, value.longitude, value.latitude))
        throw Object.assign(Error('GEO_POINT_OUTSIDE'), { code: 'GEO_POINT_OUTSIDE' });
      const key = (point) => `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`;
      if (workerData.exclude.some((point) => key(point) === key(value)))
        throw Object.assign(Error('GEO_POINT_DUPLICATE'), { code: 'GEO_POINT_DUPLICATE' });
    } else value = generatePoints(boundary, workerData.count, { exclude: workerData.exclude });
  }
  parentPort.postMessage({ ok: true, value });
} catch (e) {
  parentPort.postMessage({
    ok: false,
    code: /^(GEO_[A-Z_]+|CANCELLED)$/.test(e.code || '') ? e.code : 'GEO_INVALID_CATALOG'
  });
}
