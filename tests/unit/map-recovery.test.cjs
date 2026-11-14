const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test('TZ9 failed tile does not block siblings; dedup cancellation keeps other consumers alive', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const png = await require('sharp')({
    create: { width: 256, height: 256, channels: 3, background: '#246843' }
  })
    .png()
    .toBuffer();
  let calls = 0,
    aborted = 0;
  const service = require('../../electron/features/geo/tiles.cjs').createTileService({
    root,
    request: async (url, { signal }) => {
      calls++;
      if (url.endsWith('/0/0.png')) throw Error('temporary');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 60);
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            aborted++;
            reject(Error('aborted'));
          },
          { once: true }
        );
      });
      return png;
    }
  });
  await assert.rejects(service.tile({ z: 2, x: 0, y: 0 }));
  assert.match(await service.tile({ z: 2, x: 1, y: 0 }), /^data:image/);
  const a = service.tile({ z: 2, x: 2, y: 0, requestId: 'consumer-a' });
  const b = service.tile({ z: 2, x: 2, y: 0, requestId: 'consumer-b' });
  const rejected = assert.rejects(a, /CANCELLED/);
  await pause(10);
  service.cancel('consumer-a');
  await rejected;
  assert.match(await b, /^data:image/);
  assert.equal(calls, 3);
  assert.equal(aborted, 0);
  const c = service.tile({ z: 2, x: 3, y: 0, requestId: 'consumer-c' });
  const cancelled = assert.rejects(c, /CANCELLED/);
  await pause(10);
  service.cancel('consumer-c');
  await cancelled;
  assert.equal(aborted, 1);
});
test('TZ9 viewport scheduler retries individually, bounds requests and ignores stale replies', async () => {
  const { createMapTileLoader } = await import('../../src/js/utils/map-tile-loader.mjs');
  let active = 0,
    maximum = 0;
  const calls = new Map(),
    cache = new Map();
  const loader = createMapTileLoader({
    cache,
    retryDelay: 5,
    timeoutMs: 100,
    load: async ({ x }) => {
      calls.set(x, (calls.get(x) || 0) + 1);
      active++;
      maximum = Math.max(maximum, active);
      await pause(10);
      active--;
      if (x === 0) throw Error('offline');
      return x;
    },
    decode: async (x) => x,
    cancel: () => {},
    onChange: () => {}
  });
  loader.update(Array.from({ length: 8 }, (_, x) => ({ z: 4, x, y: 1 })));
  await pause(180);
  assert.equal(loader.snapshot().ready, 7);
  assert.equal(loader.snapshot().failed, 1);
  assert.equal(calls.get(0), 3);
  assert.ok(maximum <= 4);
  loader.update([{ z: 4, x: 8, y: 1 }]);
  loader.update([{ z: 4, x: 9, y: 1 }]);
  await pause(40);
  assert.equal(loader.snapshot().ready, 1);
  assert.ok(cache.has('4/9/1'));
  assert.ok(!cache.has('4/8/1'));
  assert.ok(!calls.has(8), 'cancel before dispatch must not start a stale network request');
  loader.dispose();
});
test(
  'TZ9 a cancelled consumer ID cannot settle or erase a later request using that ID',
  { timeout: 2000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-consumer-reuse-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const png = await require('sharp')({
      create: { width: 256, height: 256, channels: 3, background: '#246843' }
    })
      .png()
      .toBuffer();
    const service = require('../../electron/features/geo/tiles.cjs').createTileService({
      root,
      request: async () => {
        await pause(50);
        return png;
      }
    });
    const first = service.tile({ z: 2, x: 1, y: 1, requestId: 'same-id' });
    const rejected = assert.rejects(first, /CANCELLED/);
    await pause(10);
    service.cancel('same-id');
    const second = service.tile({ z: 2, x: 2, y: 1, requestId: 'same-id' });
    await rejected;
    const value = await Promise.race([
      second,
      pause(500).then(() => {
        throw Error('REPLACEMENT_DID_NOT_SETTLE');
      })
    ]);
    assert.match(value, /^data:image/);
  }
);
test('TZ9 exhausted retained tiles notify a new viewport once so Retry survives remount', async () => {
  const { createMapTileLoader } = await import('../../src/js/utils/map-tile-loader.mjs');
  const attempts = new Map([['2/1/1', { count: 3, at: 0 }]]);
  let notifications = 0,
    loads = 0;
  const loader = createMapTileLoader({
    attempts,
    load: async () => {
      loads++;
    },
    cancel: () => {},
    decode: async (x) => x,
    onChange: () => notifications++
  });
  const wanted = [{ z: 2, x: 1, y: 1 }];
  loader.update(wanted);
  assert.equal(loader.snapshot().failed, 1);
  assert.equal(loads, 0);
  assert.equal(notifications, 1);
  loader.update(wanted);
  assert.equal(notifications, 1, 'unchanged viewport must not create a redraw loop');
  loader.update([]);
  loader.update(wanted);
  assert.equal(notifications, 3, 'off/on restores terminal status');
  loader.dispose();
});
