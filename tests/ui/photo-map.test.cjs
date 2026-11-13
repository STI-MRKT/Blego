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
    for (let i = 0; i < 5; i++) await page.locator('[data-map-action="zoom-in"]').click();
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
    await page.locator('[data-map-action="after"]').click();
    await page.waitForFunction(
      () => document.querySelector('#photo-map-canvas').dataset.points === '3'
    );
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
