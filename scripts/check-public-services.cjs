// One bounded public target and one world tile; no credentials, bulk download or pan/zoom.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
(async () => {
  const out = process.argv[2];
  if (!out) throw Error('REPORT_PATH_REQUIRED');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-public-'));
  const report = {
    at: new Date().toISOString(),
    host: process.platform + '-' + process.arch,
    facebook: {},
    map: {}
  };
  let app;
  try {
    const fb = require('../electron/features/facebook/service.cjs').createFacebookService();
    const target = require('../electron/features/facebook/normalize.cjs').normalizeTarget(
      'https://www.facebook.com/Meta'
    );
    for await (const r of fb.check({ targets: [target], runId: 'public-qa' }))
      report.facebook = {
        status: r.status === 'PROFILE_VISIBLE' ? 'PASS' : 'BLOCKED',
        target: target.canonicalUrl,
        result: r.status,
        reason: r.reasonCode,
        durationMs: r.durationMs,
        scope: 'One anonymous public profile; not a complete real-target acceptance matrix'
      };
    const data = path.join(root, 'data');
    try {
      await require('../electron/features/geo/tiles.cjs')
        .createTileService({ root: data })
        .tile({ z: 0, x: 0, y: 0 });
      report.map = {
        status: 'PASS',
        source: 'https://tile.openstreetmap.org/0/0/0.png',
        scope:
          'One visible world tile through production transport and validated disk cache; no public pan/zoom automation'
      };
    } catch (e) {
      report.map = { status: 'BLOCKED', reason: e.code || e.message };
    }
    if (report.map.status === 'PASS' && process.env.BLEGO_EXECUTABLE) {
      const store = await require('../electron/local/store.cjs').openStore(data);
      store.set('tourSeen', true);
      store.close();
      const photo = await require('../tests/fixtures/images.cjs').imageFixture(root, 'png');
      app = await require('playwright')._electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE,
        args: [`--user-data-dir=${data}`]
      });
      const page = await app.firstWindow();
      await page.locator('[data-view="photos"]').click();
      await page.locator('#photo-input').setInputFiles(photo);
      await page.waitForFunction(
        () => Number(document.getElementById('photo-map-canvas')?.dataset.points) > 0
      );
      await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        state.photoMap.view = { center: { latitude: 0, longitude: 0 }, scale: 256 / 360 };
        window.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const c = document.getElementById('photo-map-canvas');
        window.__worldBefore = Array.from(
          c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        );
      });
      await page.locator('[data-map-action="background"]').click();
      await page.waitForFunction(() => {
        const c = document.getElementById('photo-map-canvas'),
          a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < a.length; i += 4)
          if (a[i] !== __worldBefore[i] || a[i + 1] !== __worldBefore[i + 1]) n++;
        return n > 1000;
      });
      await page
        .locator('.photo-map')
        .screenshot({ path: path.join(path.dirname(out), 'map-live-world.png') });
      report.map.installedRender = 'PASS';
    }
  } catch (e) {
    report.error = e.message;
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
})();
