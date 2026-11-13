import { createWorkspaceResolver } from './image-workspace.mjs';
const maxLatitude = 85.0511287798066;
const mercator = (latitude) =>
  (Math.log(
    Math.tan(
      Math.PI / 4 + (Math.max(-maxLatitude, Math.min(maxLatitude, latitude)) * Math.PI) / 360
    )
  ) *
    180) /
  Math.PI;
const latitudeOf = (y) => (Math.atan(Math.sinh((y * Math.PI) / 180)) * 180) / Math.PI;
const coordinate = (value) =>
  value &&
  Number.isFinite(value.latitude) &&
  Number.isFinite(value.longitude) &&
  Math.abs(value.latitude) <= 90 &&
  Math.abs(value.longitude) <= 180
    ? { latitude: value.latitude, longitude: value.longitude }
    : null;
export function photoMapRows(photos, workspace) {
  const resolve = workspace ? createWorkspaceResolver(workspace) : null;
  return photos.map((photo) => {
    const before = coordinate(photo.view?.tags?.find((tag) => tag.field === 'gps')?.value);
    const op = workspace?.membership?.[photo.fileId]
      ? resolve(photo.fileId).find((op) => op.field === 'gps')
      : null;
    const after =
      op?.action === 'set' ? coordinate(op.value) : op?.action === 'remove' ? null : before;
    return {
      id: photo.fileId,
      name: photo.name,
      before,
      after,
      status: photo.status,
      thumbnail: photo.thumbnail || null
    };
  });
}
export function fitMap(points, geometry, width, height) {
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  const add = ([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };
  for (const p of points) if (p) add([p.longitude, p.latitude]);
  if (geometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) for (const p of ring) add(p);
  }
  if (!Number.isFinite(west)) {
    west = -180;
    east = 180;
    south = -90;
    north = 90;
  }
  return {
    center: {
      longitude: (east + west) / 2,
      latitude:
        Math.abs(north + south) < 1e-12 ? 0 : latitudeOf((mercator(north) + mercator(south)) / 2)
    },
    scale: Math.max(
      0.1,
      Math.min(
        Math.max(1, width - 48) / Math.max(0.002, east - west),
        Math.max(1, height - 48) / Math.max(0.002, mercator(north) - mercator(south))
      )
    )
  };
}
export function project(point, view, width, height) {
  return {
    x: width / 2 + (point.longitude - view.center.longitude) * view.scale,
    y: height / 2 - (mercator(point.latitude) - mercator(view.center.latitude)) * view.scale
  };
}
export function unproject(point, view, width, height) {
  return {
    longitude: view.center.longitude + (point.x - width / 2) / view.scale,
    latitude: latitudeOf(mercator(view.center.latitude) - (point.y - height / 2) / view.scale)
  };
}
export function clusterPoints(points, view, width, height, size = 32) {
  const cells = new Map();
  for (const point of points) {
    const p = project(point, view, width, height);
    if (p.x < -size || p.y < -size || p.x > width + size || p.y > height + size) continue;
    const key = `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
    if (!cells.has(key)) cells.set(key, { key, x: 0, y: 0, ids: [], points: [] });
    const cell = cells.get(key);
    cell.x += p.x;
    cell.y += p.y;
    cell.ids.push(point.id);
    cell.points.push(point);
  }
  return [...cells.values()].map((c) => ({ ...c, x: c.x / c.ids.length, y: c.y / c.ids.length }));
}

export function visibleTiles(view, width, height) {
  const z = Math.max(0, Math.min(19, Math.floor(Math.log2((360 * view.scale) / 256)))),
    n = 2 ** z;
  const nw = unproject({ x: 0, y: 0 }, view, width, height),
    se = unproject({ x: width, y: height }, view, width, height);
  const tx = (lon) => Math.floor(((lon + 180) / 360) * n),
    ty = (lat) => Math.floor(((180 - mercator(lat)) / 360) * n);
  const result = [];
  for (let y = Math.max(0, ty(nw.latitude)); y <= Math.min(n - 1, ty(se.latitude)); y++)
    for (let x = Math.max(0, tx(nw.longitude)); x <= Math.min(n - 1, tx(se.longitude)); x++) {
      if (result.length >= 32) return result;
      const topLeft = project(
        { longitude: (x / n) * 360 - 180, latitude: latitudeOf(180 - (y / n) * 360) },
        view,
        width,
        height
      );
      const bottomRight = project(
        { longitude: ((x + 1) / n) * 360 - 180, latitude: latitudeOf(180 - ((y + 1) / n) * 360) },
        view,
        width,
        height
      );
      result.push({
        z,
        x,
        y,
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y
      });
    }
  return result;
}
