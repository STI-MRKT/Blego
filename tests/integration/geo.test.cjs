const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGeoService } = require('../../electron/features/geo/service.cjs');
const { openStore } = require('../../electron/local/store.cjs');
const { validateBoundary, contains } = require('../../electron/features/geo/geometry.cjs');
const bundled = require('../../resources/geo/cities.json');
test('every bundled country has a real provenance-bearing boundary and verified generated points', async (t) => {
  const service = createGeoService();
  t.after(() => service.close());
  assert.deepEqual(
    service
      .catalog()
      .countries.map((c) => c.code)
      .sort(),
    ['BR', 'DE', 'ES', 'FR', 'GB', 'IT', 'PL', 'US']
  );
  for (const c of bundled.cities) {
    assert.match(c.sourceUrl, /^https:\/\/www.openstreetmap.org\/relation\/\d+$/);
    assert.equal(c.license, 'ODbL-1.0');
    const result = await service.generate({ cityId: c.id, count: 100, requestId: c.country });
    const geometry = validateBoundary(c.geometry);
    assert.ok(result.points.every((p) => contains(geometry, p.longitude, p.latitude)));
    assert.equal(result.city.id, c.id);
    assert.equal(new Set(result.points.map((p) => JSON.stringify(p))).size, 100);
    assert.ok(!Object.hasOwn(result.points[0], 'altitude'));
  }
  await assert.rejects(
    service.generate({ cityId: 'unknown', count: 1, requestId: 'missing' }),
    /GEO_BOUNDARY_UNAVAILABLE/
  );
});
test('local geo import is previewed, bounded, confirmed and cached in the existing store', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-geo-'));
  let store = await openStore(dir);
  let service = createGeoService({ store });
  t.after(() => {
    service.close();
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const city = {
    ...bundled.cities[0],
    id: 'local:test-city',
    country: 'CA',
    name: 'Synthetic polygon test',
    source: 'Synthetic fixture',
    sourceUrl: 'https://example.test/boundary',
    license: 'CC0-1.0',
    version: 'test-1',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ]
      ]
    }
  };
  const preview = await service.previewImport(
    Buffer.from(JSON.stringify({ version: 1, cities: [city] }))
  );
  assert.equal(preview.added, 1);
  assert.equal(service.catalog({ country: 'CA' }).cities.length, 0);
  assert.throws(() => service.confirmImport('invalid'), /GEO_INVALID_PREVIEW/);
  service.confirmImport(preview.token);
  service.close();
  store.close();
  store = await openStore(dir);
  service = createGeoService({ store });
  assert.equal(service.catalog({ country: 'CA', query: 'synthetic' }).cities.length, 1);
  const dup = await service.previewImport(
    Buffer.from(JSON.stringify({ version: 1, cities: [city] }))
  );
  assert.equal(dup.duplicates, 1);
  await assert.rejects(
    service.previewImport(Buffer.alloc(8 * 1024 * 1024 + 1)),
    /GEO_INPUT_TOO_LARGE/
  );
  await assert.rejects(
    service.previewImport(
      Buffer.from(
        JSON.stringify({ version: 1, cities: [{ ...city, sourceUrl: 'javascript:alert(1)' }] })
      )
    ),
    /GEO_INVALID_CATALOG/
  );
});
test('generation can be cancelled without late results or source substitution', async (t) => {
  const service = createGeoService();
  t.after(() => service.close());
  const pending = service.generate({
    cityId: bundled.cities[0].id,
    count: 100,
    requestId: 'cancel'
  });
  service.cancel('cancel');
  await assert.rejects(pending, /CANCELLED/);
});
