// Bounded anonymous QA: one public Facebook target and one requested city viewport.
// Synthetic photos stay local; only normal OSM z/x/y tiles are requested.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
(async () => {
  const out = process.argv[2];
  if (!out) throw Error('REPORT_PATH_REQUIRED');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-public-city-'));
  const report = {
    at: new Date().toISOString(),
    host: process.platform + '-' + process.arch,
    facebook: {},
    map: { status: 'BLOCKED' }
  };
  let app;
  try {
    const fb = require('../electron/features/facebook/service.cjs').createFacebookService();
    const target = require('../electron/features/facebook/normalize.cjs').normalizeTarget(
      'https://www.facebook.com/Meta'
    );
    const { facebookPresentation } = await import('../shared/facebook-presentation.mjs');
    for await (const r of fb.check({ targets: [target], runId: 'public-qa' })) {
      const shown = facebookPresentation(r);
      report.facebook = {
        status: ['ACTIVE', 'BLOCKED'].includes(shown.status) ? 'PASS' : 'BLOCKED',
        target: target.canonicalUrl,
        result: shown.status,
        reason: r.reasonCode,
        httpStatus: r.httpStatus,
        durationMs: r.durationMs,
        scope: 'One anonymous public target; no credentials or platform-bypass methods'
      };
    }
    const data = path.join(root, 'data');
    const store = await require('../electron/local/store.cjs').openStore(data);
    store.set('tourSeen', true);
    store.close();
    const { imageFixture, distinctCopies } = require('../tests/fixtures/images.cjs');
    const photo = await imageFixture(root, 'jpeg');
    app = await require('playwright')._electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ]
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(distinctCopies(photo, 20));
    const { waitForAsync } = require('../tests/fixtures/wait-for-async.cjs');
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.photos.length === 20;
    });
    await page.locator('#geo-country').fill('IT');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city').selectOption('osm:relation:41485');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && !state.geoBusy && state.photoMap.mode === 'after';
    });
    await page.locator('#photo-map-canvas').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const c = document.getElementById('photo-map-canvas');
      window.__cityBefore = Array.from(
        c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      );
    });
    await page.locator('[data-map-action="background"]').click();
    let failure = null;
    try {
      await page.waitForFunction(
        () => {
          const c = document.getElementById('photo-map-canvas'),
            a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let changed = 0;
          for (let i = 0; i < a.length; i += 4)
            if (a[i] !== __cityBefore[i] || a[i + 1] !== __cityBefore[i + 1]) changed++;
          return (
            Number(c.dataset.requiredTiles) > 0 &&
            c.dataset.tiles === c.dataset.requiredTiles &&
            changed > 1000
          );
        },
        null,
        { timeout: 45000 }
      );
    } catch {
      failure = 'CITY_TILES_INCOMPLETE';
    }
    const evidence = await page.evaluate(async () => {
      const { state } = await import('/js/state.js'),
        { visibleTiles } = await import('/shared/photo-map.mjs');
      const c = document.getElementById('photo-map-canvas'),
        r = c.getBoundingClientRect();
      return {
        cityId: state.geoCity,
        center: state.photoMap.view.center,
        mode: c.dataset.mode,
        points: Number(c.dataset.points),
        rendered: Number(c.dataset.tiles),
        required: Number(c.dataset.requiredTiles),
        tiles: visibleTiles(state.photoMap.view, r.width, r.height).map(({ z, x, y }) => ({
          z,
          x,
          y
        })),
        message: document.getElementById('map-background-status').textContent
      };
    });
    const city =
      evidence.center.latitude > 41 &&
      evidence.center.latitude < 43 &&
      evidence.center.longitude > 11 &&
      evidence.center.longitude < 14 &&
      evidence.tiles.every((t) => t.z >= 8);
    report.map = {
      status: !failure && city && evidence.points === 20 ? 'PASS' : 'BLOCKED',
      reason: failure || (!city ? 'WRONG_CITY_VIEW' : null),
      ...evidence,
      scope:
        'Actual OSM city viewport and Canvas pixels in Electron; synthetic 20-photo GPS plan, no metadata sent to provider'
    };
    await page
      .locator('.photo-map')
      .screenshot({ path: path.join(path.dirname(out), 'map-live-rome.png') });
  } catch (e) {
    report.error = /^[A-Z_]+$/.test(e.message) ? e.message : 'LIVE_CHECK_UNAVAILABLE';
    report.map.status = 'BLOCKED';
  } finally {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
