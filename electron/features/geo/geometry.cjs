const { randomBytes } = require('node:crypto');
const fail = (code) => {
  throw Object.assign(Error(code), { code });
};
const rad = Math.PI / 180;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const on = (a, b, p) =>
  Math.abs(cross(a, b, p)) < 1e-12 &&
  p[0] >= Math.min(a[0], b[0]) &&
  p[0] <= Math.max(a[0], b[0]) &&
  p[1] >= Math.min(a[1], b[1]) &&
  p[1] <= Math.max(a[1], b[1]);
function ringContains(ring, x, y) {
  let inside = false;
  const point = [x, y];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1];
    if (on(a, b, point)) return 0;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside ? 1 : -1;
}
function intersects(a, b, c, d) {
  const ab1 = cross(a, b, c),
    ab2 = cross(a, b, d),
    cd1 = cross(c, d, a),
    cd2 = cross(c, d, b);
  return (
    (ab1 * ab2 < 0 && cd1 * cd2 < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)
  );
}
function validateBoundary(input) {
  const g = input?.type === 'Feature' ? input.geometry : input;
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type) || !Array.isArray(g.coordinates))
    fail('GEO_BOUNDARY_UNAVAILABLE');
  const raw = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  if (!raw.length || raw.length > 100) fail('GEO_INVALID_GEOMETRY');
  let vertices = 0,
    work = 0;
  const parts = raw.map((rings) => {
    if (!Array.isArray(rings) || !rings.length || rings.length > 200) fail('GEO_INVALID_GEOMETRY');
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    rings.forEach((ring, ri) => {
      if (!Array.isArray(ring) || ring.length < 4 || (vertices += ring.length) > 50000)
        fail('GEO_INVALID_GEOMETRY');
      let area = 0;
      ring.forEach((p, i) => {
        if (
          !Array.isArray(p) ||
          p.length !== 2 ||
          !p.every(Number.isFinite) ||
          Math.abs(p[0]) > 180 ||
          Math.abs(p[1]) >= 90
        )
          fail('GEO_INVALID_GEOMETRY');
        if (ri === 0) {
          bounds[0] = Math.min(bounds[0], p[0]);
          bounds[1] = Math.min(bounds[1], p[1]);
          bounds[2] = Math.max(bounds[2], p[0]);
          bounds[3] = Math.max(bounds[3], p[1]);
        }
        if (i) {
          const prev = ring[i - 1];
          if (p[0] === prev[0] && p[1] === prev[1]) fail('GEO_INVALID_GEOMETRY');
          area += prev[0] * p[1] - p[0] * prev[1];
        }
      });
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1] || Math.abs(area) < 1e-14)
        fail('GEO_INVALID_GEOMETRY');
    });
    if (bounds[2] - bounds[0] > 180) fail('GEO_DATELINE_UNSUPPORTED');
    // Sweep by longitude with an explicit pair budget; never accept a geometry
    // merely because topology validation ran out of resources.
    const edges = rings
      .flatMap((r, ri) =>
        r.slice(0, -1).map((a, i) => ({
          a,
          b: r[i + 1],
          ri,
          i,
          n: r.length - 1,
          min: Math.min(a[0], r[i + 1][0]),
          max: Math.max(a[0], r[i + 1][0])
        }))
      )
      .sort((a, b) => a.min - b.min);
    let active = [];
    for (const edge of edges) {
      active = active.filter((e) => e.max >= edge.min);
      for (const other of active) {
        if (++work > 3000000) fail('GEO_GEOMETRY_TOO_COMPLEX');
        if (
          edge.ri === other.ri &&
          (Math.abs(edge.i - other.i) === 1 || Math.abs(edge.i - other.i) === edge.n - 1)
        )
          continue;
        if (intersects(edge.a, edge.b, other.a, other.b)) fail('GEO_INVALID_GEOMETRY');
      }
      active.push(edge);
    }
    for (let i = 1; i < rings.length; i++) {
      if (ringContains(rings[0], ...rings[i][0]) !== 1) fail('GEO_INVALID_GEOMETRY');
      for (let j = 1; j < i; j++)
        if (
          ringContains(rings[j], ...rings[i][0]) >= 0 ||
          ringContains(rings[i], ...rings[j][0]) >= 0
        )
          fail('GEO_INVALID_GEOMETRY');
    }
    const weight =
      (bounds[2] - bounds[0]) * (Math.sin(bounds[3] * rad) - Math.sin(bounds[1] * rad));
    if (!(weight > 0)) fail('GEO_INVALID_GEOMETRY');
    return { rings, bounds, weight };
  });
  // Multipart overlaps would bias rejection sampling. Reject ambiguous overlap
  // instead of silently weighting shared area twice.
  for (let i = 0; i < parts.length; i++)
    for (let j = 0; j < i; j++) {
      const a = parts[i],
        b = parts[j];
      if (
        a.bounds[2] < b.bounds[0] ||
        b.bounds[2] < a.bounds[0] ||
        a.bounds[3] < b.bounds[1] ||
        b.bounds[3] < a.bounds[1]
      )
        continue;
      if (
        a.rings[0].some((p) => partContains(b, ...p)) ||
        b.rings[0].some((p) => partContains(a, ...p))
      )
        fail('GEO_INVALID_GEOMETRY');
      for (const ar of a.rings)
        for (const br of b.rings)
          for (let ai = 0; ai < ar.length - 1; ai++)
            for (let bi = 0; bi < br.length - 1; bi++) {
              if (++work > 3000000) fail('GEO_GEOMETRY_TOO_COMPLEX');
              const x = cross(ar[ai], ar[ai + 1], br[bi]),
                y = cross(ar[ai], ar[ai + 1], br[bi + 1]);
              if (
                x * y < 0 &&
                cross(br[bi], br[bi + 1], ar[ai]) * cross(br[bi], br[bi + 1], ar[ai + 1]) < 0
              )
                fail('GEO_INVALID_GEOMETRY');
            }
    }
  return { parts, vertices };
}
function partContains(part, x, y) {
  const b = part.bounds;
  return (
    x >= b[0] &&
    x <= b[2] &&
    y >= b[1] &&
    y <= b[3] &&
    ringContains(part.rings[0], x, y) === 1 &&
    part.rings.slice(1).every((r) => ringContains(r, x, y) === -1)
  );
}
function contains(boundary, longitude, latitude) {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    boundary.parts.some((p) => partContains(p, longitude, latitude))
  );
}
function generatePoints(boundary, count, { exclude = [], signal, maxAttempts = 200000 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) fail('GEO_INVALID_COUNT');
  if (
    !Array.isArray(exclude) ||
    exclude.length > 10000 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 200000
  )
    fail('GEO_INVALID_OPTIONS');
  const seen = new Set(exclude.map((p) => `${p.latitude.toFixed(7)},${p.longitude.toFixed(7)}`)),
    points = [];
  const weight = boundary.parts.reduce((n, p) => n + p.weight, 0);
  let bytes = randomBytes(6000),
    at = 0,
    work = 0;
  const random = () => {
    if (at + 6 > bytes.length) {
      bytes = randomBytes(6000);
      at = 0;
    }
    const value = bytes.readUIntBE(at, 6) / 281474976710656;
    at += 6;
    return value;
  };
  for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt++) {
    if (signal?.aborted) fail('CANCELLED');
    if ((work += boundary.vertices) > 50000000) fail('GEO_GENERATION_EXHAUSTED');
    let choice = random() * weight,
      part = boundary.parts.at(-1);
    for (const p of boundary.parts) {
      choice -= p.weight;
      if (choice < 0) {
        part = p;
        break;
      }
    }
    const [west, south, east, north] = part.bounds;
    const longitude = Number((west + random() * (east - west)).toFixed(7));
    const latitude = Number(
      (
        Math.asin(
          Math.sin(south * rad) + random() * (Math.sin(north * rad) - Math.sin(south * rad))
        ) / rad
      ).toFixed(7)
    );
    const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    // Reject against the selected proposal part: overlapping boxes must not double-weight other parts.
    if (!seen.has(key) && partContains(part, longitude, latitude)) {
      seen.add(key);
      points.push({ latitude, longitude });
    }
  }
  if (points.length !== count) fail('GEO_GENERATION_EXHAUSTED');
  return points;
}
module.exports = { validateBoundary, contains, generatePoints };
