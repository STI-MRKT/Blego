const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ06 map tile placement uses Mercator and only the bounded visible viewport', async () => {
  const m = await import('../../shared/photo-map.mjs');
  const view = { center: { longitude: 0, latitude: 0 }, scale: 1 };
  const p = m.project({ longitude: 0, latitude: 60 }, view, 360, 260);
  assert.ok(Math.abs(p.y - (130 - 75.4561292902)) < 1e-6);
  assert.ok(Math.abs(m.unproject(p, view, 360, 260).latitude - 60) < 1e-8);
  assert.equal(typeof m.visibleTiles, 'function');
  const tiles = m.visibleTiles(
    m.fitMap([{ longitude: 2.35, latitude: 48.85 }], null, 360, 260),
    360,
    260
  );
  assert.ok(tiles.length > 0 && tiles.length <= 32);
  for (const t of tiles) {
    assert.ok(t.z >= 0 && t.z <= 19);
    assert.ok(t.x >= 0 && t.x < 2 ** t.z);
    assert.ok(t.y >= 0 && t.y < 2 ** t.z);
  }
});
test('TZ06 tile service is explicit, bounded and caches without collecting photo data', async (t) => {
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tiles-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { createTileService } = require('../../electron/features/geo/tiles.cjs');
  const png = await require('sharp')({
    create: { width: 256, height: 256, channels: 3, background: '#246843' }
  })
    .png()
    .toBuffer();
  let calls = 0;
  const request = async (url, opts) => {
    calls++;
    assert.equal(url, 'https://tile.openstreetmap.org/2/2/1.png');
    assert.match(opts.headers['User-Agent'], /^BLEGO/);
    return png;
  };
  let service = createTileService({ root, request });
  assert.equal(calls, 0);
  const result = await service.tile({ z: 2, x: 2, y: 1 });
  assert.match(result, /^data:image\/png;base64,/);
  service = createTileService({ root, request });
  assert.equal(await service.tile({ z: 2, x: 2, y: 1 }), result);
  assert.equal(calls, 1);
  for (const value of [
    { z: 2, x: -1, y: 1 },
    { z: 30, x: 0, y: 0 },
    { z: 2, x: 4, y: 1 },
    { z: 2, x: 2, y: 1, photo: 'SECRET' }
  ])
    await assert.rejects(service.tile(value));
});
