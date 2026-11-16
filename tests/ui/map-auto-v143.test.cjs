const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright'),
  sharp = require('sharp');
const { imageFixture } = require('../fixtures/images.cjs');
test(
  'Photos automatically paints its basemap on empty start, missing GPS, Before/After, resize and restart',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-map-auto-'));
    const file = await imageFixture(root, 'png', { metadata: false });
    const raster = (
      await sharp({ create: { width: 256, height: 256, channels: 3, background: '#34945a' } })
        .png()
        .toBuffer()
    ).toString('base64');
    let app;
    t.after(async () => {
      if (app) await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const launch = async () => {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${path.join(root, 'data')}`
        ]
      });
      const page = await app.firstWindow();
      await app.evaluate(({ ipcMain }, raster) => {
        globalThis.autoTileRequests = [];
        ipcMain.removeHandler('local:mapTile');
        ipcMain.handle('local:mapTile', (_event, arg) => {
          globalThis.autoTileRequests.push({ z: arg.z, x: arg.x, y: arg.y });
          return { ok: true, value: 'data:image/png;base64,' + raster };
        });
      }, raster);
      return page;
    };
    let page = await launch();
    assert.equal(await app.evaluate(() => globalThis.autoTileRequests.length), 0);
    await page.locator('[data-view="photos"]').click();
    assert.equal(await page.locator('#photo-map-canvas').count(), 1);
    const painted = async () => {
      await page.waitForFunction(() => {
        const c = document.getElementById('photo-map-canvas');
        return Number(c.dataset.tiles) > 0 && c.dataset.tiles === c.dataset.requiredTiles;
      });
      assert.equal(await page.locator('[data-map-action="background"]').count(), 0);
      const green = await page.locator('#photo-map-canvas').evaluate((c) => {
        const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < a.length; i += 4)
          if (a[i] === 52 && a[i + 1] === 148 && a[i + 2] === 90) n++;
        return n;
      });
      assert.ok(green > 1000);
    };
    await painted();
    assert.equal(await page.locator('#photo-map-canvas').getAttribute('data-points'), '0');
    await page.locator('#photo-input').setInputFiles(file);
    await page.locator('[data-photo-id]').waitFor();
    await painted();
    assert.match(await page.locator('#photo-map-status').innerText(), /Без GEO: 1/);
    for (const mode of ['after', 'before']) {
      await page.locator(`[data-map-action="${mode}"]`).click();
      await painted();
      assert.equal(await page.locator('#photo-map-canvas').getAttribute('data-points'), '0');
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 800));
    await painted();
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="photos"]').click();
    await painted();
    await app.close();
    app = null;
    page = await launch();
    await page.locator('[data-view="photos"]').click();
    await painted();
  }
);
