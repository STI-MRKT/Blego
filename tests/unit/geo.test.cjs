const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateBoundary,
  contains,
  generatePoints
} = require('../../electron/features/geo/geometry.cjs');
const box = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
  [a, b]
];
const shape = (coordinates, type = 'Polygon') => ({ type, coordinates });
test('GEO honors holes, negative and zero coordinates, multipart and unique batch values', () => {
  const g = validateBoundary(
    shape([[box(-2, -2, 2, 2), box(-1, -1, 1, 1)], [box(5, 5, 6, 6)]], 'MultiPolygon')
  );
  assert.equal(contains(g, 0, 0), false);
  assert.equal(contains(g, 0, 1.5), true);
  assert.equal(contains(g, 5.5, 5.5), true);
  const points = generatePoints(g, 100);
  assert.equal(new Set(points.map((p) => JSON.stringify(p))).size, 100);
  assert.ok(points.every((p) => contains(g, p.longitude, p.latitude)));
  const next = generatePoints(g, 100, { exclude: points });
  assert.ok(
    next.every((p) => !points.some((q) => q.latitude === p.latitude && q.longitude === p.longitude))
  );
});
test('GEO is uniform in spherical area, not uniformly by polygon or latitude', () => {
  const g = validateBoundary(shape([[box(0, 0, 10, 10)], [box(30, 60, 40, 70)]], 'MultiPolygon'));
  const pts = generatePoints(g, 1000);
  const low = pts.filter((p) => p.latitude < 20).length / pts.length;
  // Expected ratio sin(10)/(sin(10)+sin(70)-sin(60)) ~= .70; broad nonflaky envelope.
  assert.ok(low > 0.6 && low < 0.8, String(low));
});
test('GEO rejects malformed, self-crossing, outside-hole and unsupported dateline geometry', () => {
  for (const geometry of [
    shape([box(0, 0, 0, 0)]),
    shape([
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
        [0, 0]
      ]
    ]),
    shape([box(0, 0, 1, 1), box(2, 2, 3, 3)]),
    shape([box(-179, 0, 179, 1)]),
    shape([box(0, 0, 1, 91)]),
    { type: 'Point', coordinates: [0, 0] }
  ])
    assert.throws(() => validateBoundary(geometry), /GEO_/);
});
test('GEO has count, work and cancellation bounds; never substitutes a center point', () => {
  const g = validateBoundary(
    shape([
      [
        [0, 0],
        [1, 1],
        [1, 1.000000001],
        [0, 0]
      ]
    ])
  );
  assert.throws(() => generatePoints(g, 1, { maxAttempts: 10 }), /GEO_GENERATION_EXHAUSTED/);
  assert.throws(() => generatePoints(g, 1001), /GEO_INVALID_COUNT/);
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => generatePoints(g, 1, { signal: controller.signal }), /CANCELLED/);
});

test('disjoint multipart polygons with overlapping proposal boxes retain uniform area density', () => {
  const boundary = validateBoundary({
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [1.8, 0],
          [0, 1.8],
          [0, 0]
        ]
      ],
      [
        [
          [0.2, 2],
          [2, 0.2],
          [2, 2],
          [0.2, 2]
        ]
      ]
    ]
  });
  const points = Array.from({ length: 4 }, () => generatePoints(boundary, 1000)).flat();
  const overlap =
    points.filter(
      (p) => p.longitude > 0.2 && p.longitude < 1.8 && p.latitude > 0.2 && p.latitude < 1.8
    ).length / points.length;
  // Triangles do not overlap. Their boxes do; this region has ~1.96/3.24=60.49% of area.
  // Whole-union acceptance incorrectly double-weights it (~75.38%). Spherical correction <0.1%.
  assert.ok(overlap > 0.54 && overlap < 0.67, `overlapping-box fraction ${overlap}`);
  assert.ok(points.every((p) => contains(boundary, p.longitude, p.latitude)));
});
