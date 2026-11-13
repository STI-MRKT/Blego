const { validateBoundary } = require('./geometry.cjs');
const { createHash } = require('node:crypto');
const fail = () => {
  throw Object.assign(Error('GEO_INVALID_CATALOG'), { code: 'GEO_INVALID_CATALOG' });
};
function validatePackage(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.cities) ||
    !data.cities.length ||
    data.cities.length > 100
  )
    fail();
  const ids = new Set();
  return data.cities.map((city) => {
    if (!city || typeof city !== 'object') fail();
    for (const key of [
      'id',
      'country',
      'name',
      'region',
      'source',
      'sourceUrl',
      'license',
      'version'
    ])
      if (
        typeof city[key] !== 'string' ||
        city[key].length > 500 ||
        /[\u0000-\u001f]/.test(city[key]) ||
        (key !== 'region' && !city[key].trim())
      )
        fail();
    if (!/^[\w:.-]{1,120}$/.test(city.id) || !/^[A-Z]{2}$/.test(city.country) || ids.has(city.id))
      fail();
    ids.add(city.id);
    let url;
    try {
      url = new URL(city.sourceUrl);
    } catch {
      fail();
    }
    if (url.protocol !== 'https:' || url.username || url.password) fail();
    validateBoundary(city.geometry);
    const geometry = structuredClone(city.geometry);
    return {
      id: city.id,
      country: city.country,
      name: city.name,
      region: city.region,
      source: city.source,
      sourceUrl: city.sourceUrl,
      license: city.license,
      version: city.version,
      retrievedAt:
        typeof city.retrievedAt === 'string' && Number.isFinite(Date.parse(city.retrievedAt))
          ? city.retrievedAt
          : null,
      sha256: createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),
      geometry
    };
  });
}
function publicCity(city) {
  const { geometry, ...data } = city;
  void geometry;
  return structuredClone(data);
}
module.exports = { validatePackage, publicCity };
