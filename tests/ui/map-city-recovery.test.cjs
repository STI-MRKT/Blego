const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { createHash } = require('node:crypto');
const { _electron } = require('playwright');
const { imageFixture, distinctCopies } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ9 20 photos: Brazil to Italy loads city tiles, preserves consent and exports matching GPS',
  { timeout: 180000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-city-ui-'));
    const output = path.join(root, 'output');
    fs.mkdirSync(output);
    const engine = require('../../electron/features/images/engine.cjs').createEngine();
    const original = await imageFixture(root, 'jpeg');
    await engine.writeCopy(
      original,
      [
        {
          field: 'gps',
          action: 'set',
          value: { latitude: -23.55, longitude: -46.63, altitude: null }
        }
      ],
      'jpeg'
    );
    const files = distinctCopies(original, 20);
    const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    const hashes = files.map(hash);
    const seen = [];
    const raster = await require('sharp')({
      create: { width: 256, height: 256, channels: 3, background: '#34945a' }
    })
      .png()
      .toBuffer();
    const server = require('node:http').createServer((req, res) => {
      seen.push(req.url);
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(raster);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
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
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Inject only the network transport. Real IPC sender validation, service cache,
    // bounded PNG validation, renderer loader and Canvas all remain in the path.
    await app.evaluate(
      ({ app, ipcMain, BrowserWindow }, { port, root }) => {
        const require = process
          .getBuiltinModule('node:module')
          .createRequire(app.getAppPath() + '/package.json');
        const { validateSender } = require('./electron/local/ipc.cjs');
        const service = require('./electron/features/geo/tiles.cjs').createTileService({
          root,
          request: async (url, { signal }) => {
            const target = new URL(url);
            if (target.hostname !== 'tile.openstreetmap.org') throw Error('UNEXPECTED_PROVIDER');
            const response = await fetch(`http://127.0.0.1:${port}${target.pathname}`, { signal });
            return Buffer.from(await response.arrayBuffer());
          }
        });
        for (const [name, handler] of [
          ['mapTile', (arg) => service.tile(arg)],
          ['cancelMapTile', (id) => service.cancel(id)]
        ]) {
          ipcMain.removeHandler(`local:${name}`);
          ipcMain.handle(`local:${name}`, async (event, arg) => {
            const win = BrowserWindow.getAllWindows()[0];
            if (!validateSender(event, win.webContents, win.webContents.getURL()))
              throw Error('UNTRUSTED_IPC');
            try {
              return { ok: true, value: await handler(arg) };
            } catch (e) {
              return { ok: false, code: e.message };
            }
          });
        }
      },
      { port: server.address().port, root: path.join(root, 'data') }
    );
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(files);
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 20 && !state.imagesBusy;
    });
    assert.equal(seen.length, 0, 'no network without map consent');
    await page.locator('[data-map-action="background"]').click();
    const loaded = async () =>
      page.waitForFunction(() => {
        const c = document.getElementById('photo-map-canvas');
        return Number(c.dataset.tiles) > 0 && c.dataset.tiles === c.dataset.requiredTiles;
      });
    // This assertion exposes the original defect before requiring new diagnostics.
    await page.locator('#geo-country').fill('IT');
    await page.locator('#geo-country').press('Tab');
    assert.equal(
      await page.locator('[data-map-action="background"]').getAttribute('aria-pressed'),
      'true'
    );
    await page.locator('#geo-city').selectOption('osm:relation:41485');
    assert.equal(
      await page.locator('[data-map-action="background"]').getAttribute('aria-pressed'),
      'true'
    );
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && !state.geoBusy && state.photoMap.mode === 'after';
    });
    await loaded();
    const inspect = async () =>
      page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        const { visibleTiles, photoMapRows, project } = await import('/shared/photo-map.mjs');
        const c = document.getElementById('photo-map-canvas'),
          r = c.getBoundingClientRect();
        return {
          view: state.photoMap.view,
          tiles: visibleTiles(state.photoMap.view, r.width, r.height),
          rows: photoMapRows(state.photos, state.imageWorkspace),
          workspace: JSON.stringify(state.imageWorkspace),
          projected: photoMapRows(state.photos, state.imageWorkspace).map((row) =>
            project(row[state.photoMap.mode], state.photoMap.view, r.width, r.height)
          ),
          width: r.width,
          height: r.height
        };
      });
    const after = await inspect();
    assert.ok(after.view.center.latitude > 41 && after.view.center.latitude < 43);
    assert.ok(after.view.center.longitude > 11 && after.view.center.longitude < 14);
    assert.ok(after.tiles.every((tile) => tile.z >= 8));
    assert.equal(after.rows.length, 20);
    for (const p of after.projected)
      assert.ok(p.x >= 0 && p.x <= after.width && p.y >= 0 && p.y <= after.height);
    for (const tile of after.tiles) assert.ok(seen.includes(`/${tile.z}/${tile.x}/${tile.y}.png`));
    const capture = async (mode) => {
      if (process.env.BLEGO_CAPTURE) {
        fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
        await page
          .locator('.photo-map')
          .screenshot({ path: path.join(process.env.BLEGO_CAPTURE, `tz9-city-${mode}.png`) });
      }
    };
    await capture('after-rome');
    for (const mode of ['before', 'after', 'before', 'after']) {
      await page.locator(`[data-map-action="${mode}"]`).click();
      await loaded();
      assert.equal(await page.locator('#photo-map-canvas').getAttribute('data-points'), '20');
      const actual = await inspect();
      assert.equal(actual.workspace, after.workspace);
      if (mode === 'before') {
        assert.ok(Math.abs(actual.view.center.latitude + 23.55) < 0.001);
        await capture('before-brazil');
      }
    }
    const pixels = await page.locator('#photo-map-canvas').evaluate((c) => {
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let green = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 1] > data[i] + 40 && data[i + 1] > data[i + 2] + 30) green++;
      return green;
    });
    assert.ok(pixels > 1000, 'actual decoded raster pixels, not an empty grid');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(390, 800));
    await loaded();
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="photos"]').click();
    await loaded();
    assert.equal(
      await page.locator('[data-map-action="background"]').getAttribute('aria-pressed'),
      'true'
    );
    await app.evaluate(({ dialog }, output) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [output] });
    }, output);
    await page.locator('#metadata-form [type="submit"]').click();
    await page.locator('[data-action="metadata-export"]').click();
    await waitForAsync(
      page,
      async () => {
        const { state } = await import('/js/state.js');
        return !!state.metadataExport && !state.imagesBusy;
      },
      null,
      { timeout: 120000 }
    );
    const exported = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.metadataExport.files;
    });
    assert.equal(exported.length, 20);
    for (const [i, entry] of exported.entries()) {
      assert.equal(entry.status, 'completed');
      const tags = (await engine.read(path.join(output, entry.outputName || entry.name))).tags;
      const expected = after.rows.find((row) => row.id === entry.fileId) || after.rows[i];
      assert.ok(Math.abs(Number(tags['Composite:GPSLatitude']) - expected.after.latitude) < 1e-5);
      assert.ok(Math.abs(Number(tags['Composite:GPSLongitude']) - expected.after.longitude) < 1e-5);
    }
    assert.deepEqual(files.map(hash), hashes);
    assert.deepEqual(errors, []);
  }
);
