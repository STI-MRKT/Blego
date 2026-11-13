import { createWorkspaceResolver } from './image-workspace.mjs';
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
    center: { longitude: (east + west) / 2, latitude: (north + south) / 2 },
    scale: Math.max(
      0.1,
      Math.min(
        Math.max(1, width - 48) / Math.max(0.002, east - west),
        Math.max(1, height - 48) / Math.max(0.002, north - south)
      )
    )
  };
}
export function project(point, view, width, height) {
  return {
    x: width / 2 + (point.longitude - view.center.longitude) * view.scale,
    y: height / 2 - (point.latitude - view.center.latitude) * view.scale
  };
}
export function unproject(point, view, width, height) {
  return {
    longitude: view.center.longitude + (point.x - width / 2) / view.scale,
    latitude: view.center.latitude - (point.y - height / 2) / view.scale
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
