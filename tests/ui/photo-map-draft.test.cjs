const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
for (const bulk of [false, true])
  test(
    `map drag retains ${bulk ? 'other photos pending GPS and dates' : 'dirty date'} through actual preview and export`,
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
      const otherIds = await page
        .locator('[data-image-select]')
        .evaluateAll(
          (els, id) => els.map((e) => e.dataset.imageSelect).filter((x) => x !== id),
          id
        );
      for (const otherId of bulk ? otherIds.slice(1) : otherIds)
        await page.locator(`[data-image-select="${otherId}"]`).uncheck();
      await page.locator('[name="action-captureDate"]').selectOption('set');
      await page.locator('[name="date-local"]').fill('2025-05-06T12:30:00');
      if (bulk) {
        await page.locator('[name="action-gps"]').selectOption('set');
        await page.locator('#gps-manual summary').click();
        await page.locator('[name="gps-latitude"]').fill('48.86');
        await page.locator('[name="gps-longitude"]').fill('2.36');
      }

      await page.locator('#photo-map-select').selectOption(id);
      await page.waitForTimeout(100);
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

      const beforePreview = await page.evaluate(async (id) => {
        const { state } = await import('/js/state.js');
        return state.imageWorkspace.overrides[id].find((o) => o.field === 'gps').value;
      }, id);
      const out = path.join(root, 'out');
      fs.mkdirSync(out);
      await app.evaluate(({ dialog }, out) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out] });
      }, out);
      await page.locator('#metadata-form').evaluate((form) => form.requestSubmit());
      await page.locator('[data-metadata-plan]').waitFor();
      const afterPreview = await page.evaluate(async (id) => {
        const { state } = await import('/js/state.js');
        return state.imageWorkspace.overrides[id].find((o) => o.field === 'gps').value;
      }, id);
      assert.deepEqual(afterPreview, beforePreview, 'Preview must preserve dragged GPS');
      await page.locator('[data-action="metadata-export"]').click();
      await waitForAsync(page, async () => {
        const { state } = await import('/js/state.js');
        return (
          !state.imagesBusy && state.metadataExport?.files.every((f) => f.status === 'completed')
        );
      });
      const outputFiles = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return state.metadataExport.files;
      });
      assert.equal(outputFiles.length, bulk ? 2 : 1);
      const { createEngine } = require('../../electron/features/images/engine.cjs'),
        { normalizedValue } = require('../../electron/features/images/policy.cjs');
      for (const output of outputFiles) {
        const tags = (await createEngine().read(path.join(out, output.outputName || output.name)))
          .tags;
        const gps = normalizedValue('gps', tags),
          expected = output.fileId === id ? beforePreview : { latitude: 48.86, longitude: 2.36 };
        assert.ok(Math.abs(gps.latitude - expected.latitude) < 1e-7);
        assert.ok(Math.abs(gps.longitude - expected.longitude) < 1e-7);
        assert.equal(normalizedValue('captureDate', tags).local, '2025-05-06T12:30:00');
      }
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
    }
  );
