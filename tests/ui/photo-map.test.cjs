const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'local map shows Before/After, missing GPS, real pointer moves and stable resize without external requests',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-map-ui-'));
    const files = [
      await imageFixture(root, 'jpeg'),
      await imageFixture(root, 'png', { metadata: false }),
      await imageFixture(root, 'webp')
    ];
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${path.join(root, 'data')}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow(),
      external = [],
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') {
        external.push(url.origin);
        return route.abort();
      }
      return route.continue();
    });
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(files);
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.photos.length === 3;
    });
    const canvas = page.locator('#photo-map-canvas');
    await canvas.waitFor();
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '2'
    );
    assert.match(await page.locator('#photo-map-status').innerText(), /Без GEO: 1/);
    await page.locator('#geo-country').fill('FR');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city').selectOption('osm:relation:71525');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.photoMap?.mode === 'after';
    });
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '3'
    );
    // Synthetic raster fixtures exercise actual Canvas rendering without automated
    // traffic to community tile servers. Real-provider acceptance is separate.
    const tiles = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { visibleTiles } = await import('/shared/photo-map.mjs');
      const r = document.getElementById('photo-map-canvas').getBoundingClientRect();
      return visibleTiles(state.photoMap.view, r.width, r.height);
    });
    const cache = path.join(root, 'data', 'map-tiles');
    fs.mkdirSync(cache, { recursive: true });
    const raster = await require('sharp')({
      create: { width: 256, height: 256, channels: 3, background: '#34945a' }
    })
      .png()
      .toBuffer();
    for (const tile of tiles)
      fs.writeFileSync(path.join(cache, `${tile.z}-${tile.x}-${tile.y}.png`), raster);
    // Fit/resize/zoom may change the viewport after initial cache preparation.
    // Seed requested fixture tiles before the real IPC handler reads its cache;
    // keep sender/argument validation, cache decoding and Canvas rendering intact.
    await app.evaluate(
      ({ ipcMain }, fixture) => {
        const channel = 'local:mapTile';
        const original = ipcMain._invokeHandlers.get(channel);
        if (typeof original !== 'function') throw Error('MAP_IPC_HANDLER_REQUIRED');
        globalThis.mapFixtureRequests = [];
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, async (event, arg) => {
          if (
            arg &&
            [arg.z, arg.x, arg.y].every(Number.isInteger) &&
            arg.z >= 0 &&
            arg.z <= 19 &&
            arg.x >= 0 &&
            arg.y >= 0 &&
            arg.x < 2 ** arg.z &&
            arg.y < 2 ** arg.z
          ) {
            const name = `${arg.z}-${arg.x}-${arg.y}.png`;
            globalThis.mapFixtureRequests.push(name);
            process.getBuiltinModule('node:fs').writeFileSync(
              process.getBuiltinModule('node:path').join(fixture.cache, name),
              Buffer.from(fixture.raster, 'base64')
            );
          }
          return original(event, arg);
        });
      },
      { cache, raster: raster.toString('base64') }
    );
    // Zoom out to request new tiles while retaining uncovered raster pixels
    // outside the translucent city polygon for the exact-color assertion.
    for (let i = 0; i < 3; i++) await page.locator('[data-map-action="zoom-out"]').click();
    await page.locator('[data-map-action="background"]').click();
    await page.waitForFunction(
      () => Number(document.getElementById('photo-map-canvas').dataset.tiles) > 0
    );
    // A first decoded tile can intersect only a tiny edge of the viewport.
    // Wait for the same actual-pixel condition that acceptance asserts below.
    await page.waitForFunction(() => {
      const c = document.getElementById('photo-map-canvas');
      const values = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let green = 0;
      for (let i = 0; i < values.length; i += 4)
        if (values[i] === 52 && values[i + 1] === 148 && values[i + 2] === 90) green++;
      return green > 1000;
    });
    const painted = await canvas.evaluate((c) => {
      const ctx = c.getContext('2d');
      const values = ctx.getImageData(0, 0, c.width, c.height).data;
      let green = 0;
      for (let i = 0; i < values.length; i += 4)
        if (values[i] === 52 && values[i + 1] === 148 && values[i + 2] === 90) green++;
      return green;
    });
    assert.ok(painted > 1000, 'synthetic background pixels actually rendered');
    const initiallySeeded = new Set(tiles.map((tile) => `${tile.z}-${tile.x}-${tile.y}.png`));
    assert.ok(
      (await app.evaluate(() => globalThis.mapFixtureRequests)).some(
        (name) => !initiallySeeded.has(name)
      ),
      'the renderer requested a changed viewport, beyond the initial fixture cache'
    );
    await page.locator('[data-map-action="background"]').click();
    for (let i = 0; i < 3; i++) await page.locator('[data-map-action="zoom-in"]').click();
    const id = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const id = state.photos[0].fileId;
      const result = await window.blego.moveImageGeo({
        cityId: state.geoCity,
        fileId: id,
        value: { latitude: 48.8566, longitude: 2.3522 },
        workspaceRevision: state.imageWorkspace.revision,
        requestId: crypto.randomUUID()
      });
      state.imageWorkspace = result.workspace;
      return id;
    });
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-map-select').selectOption(id);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#photo-map-inspector img').count(), 1);
    assert.equal(await page.locator(`[data-photo-id="${id}"].map-selected`).count(), 1);
    const coordinates = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { project } = await import('/shared/photo-map.mjs');
      const rect = document.getElementById('photo-map-canvas').getBoundingClientRect();
      const local = project(
        { latitude: 48.8567, longitude: 2.3523 },
        state.photoMap.view,
        rect.width,
        rect.height
      );
      return {
        start: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        end: { x: rect.x + local.x, y: rect.y + local.y },
        scale: state.photoMap.view.scale
      };
    });
    // Zoom in until a precise, in-city move exceeds the deliberate drag threshold.
    for (let i = 0; i < 12; i++) {
      const distance = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return Math.SQRT2 * 0.0001 * state.photoMap.view.scale;
      });
      if (distance >= 12) break;
      await page.locator('[data-map-action="zoom-in"]').click();
    }
    await canvas.scrollIntoViewIfNeeded();
    const drag = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { project } = await import('/shared/photo-map.mjs');
      const r = document.getElementById('photo-map-canvas').getBoundingClientRect();
      const p = project(
        { latitude: 48.8567, longitude: 2.3523 },
        state.photoMap.view,
        r.width,
        r.height
      );
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, endX: r.x + p.x, endY: r.y + p.y };
    });
    assert.ok(Math.hypot(drag.endX - drag.x, drag.endY - drag.y) >= 12);
    await page.mouse.move(drag.x, drag.y);
    await page.mouse.down();
    await page.mouse.move(drag.endX, drag.endY, { steps: 5 });
    await page.mouse.up();
    await waitForAsync(
      page,
      async (id) => {
        const { state } = await import('/js/state.js');
        return (
          !state.imagesBusy &&
          Math.abs(
            state.imageWorkspace.overrides[id].find((o) => o.field === 'gps').value.latitude -
              48.8567
          ) < 1e-7
        );
      },
      id
    );
    await page.locator('[data-map-action="before"]').click();
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '2'
    );
    if (process.env.BLEGO_CAPTURE) {
      await canvas.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'v14-map-before.png') });
    }
    await page.locator('[data-map-action="after"]').click();
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '3'
    );
    if (process.env.BLEGO_CAPTURE) {
      await canvas.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'v14-map-after.png') });
    }
    await canvas.focus();
    const scale = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.photoMap.view.scale;
    });
    await page.keyboard.press('+');
    await waitForAsync(
      page,
      async (scale) => {
        const { state } = await import('/js/state.js');
        return state.photoMap.view.scale > scale;
      },
      scale
    );
    const prior = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return {
        view: state.photoMap.view,
        selected: state.photoMap.selected,
        workspace: state.imageWorkspace
      };
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 980, height: 720 })
    );
    await page.waitForTimeout(100);
    assert.deepEqual(
      await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return {
          view: state.photoMap.view,
          selected: state.photoMap.selected,
          workspace: state.imageWorkspace
        };
      }),
      prior
    );
    assert.ok(coordinates.scale > 0);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    // Renderer-only stress: 1000 synthetic markers, not a claim of 1000 real imports.
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { emptyWorkspace } = await import('/shared/image-workspace.mjs');
      state.imageWorkspace = emptyWorkspace();
      state.photos = Array.from({ length: 1000 }, (_, i) => {
        const fileId = `map-${i}`;
        state.imageWorkspace.membership[fileId] = 'ungrouped';
        return {
          fileId,
          name: `Synthetic ${i}.jpg`,
          status: 'ready',
          size: 1,
          view: {
            capabilities: { writable: true },
            tags: [
              {
                field: 'gps',
                value: {
                  latitude: 48.85 + (i % 25) * 0.0001,
                  longitude: 2.35 + Math.floor(i / 25) * 0.0001
                }
              }
            ]
          }
        };
      });
      state.photoMap = { mode: 'before', view: null, selected: null };
    });
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="photos"]').click();
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '1000'
    );
    assert.ok(Number(await canvas.getAttribute('data-clusters')) < 1000);
    await page.locator('[data-map-action="zoom-in"]').click();
    assert.equal(await page.locator('.photo-grid .ph').count(), 100);
  }
);
