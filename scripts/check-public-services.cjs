// Bounded anonymous QA: one public Facebook target and two requested city viewports (Before/After).
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
    const data = path.join(root, 'data');
    const store = await require('../electron/local/store.cjs').openStore(data);
    store.set('tourSeen', true);
    store.close();
    const { imageFixture, distinctCopies } = require('../tests/fixtures/images.cjs');
    const photo = await imageFixture(root, 'jpeg');
    await require('../electron/features/images/engine.cjs')
      .createEngine()
      .writeCopy(
        photo,
        [
          {
            field: 'gps',
            action: 'set',
            value: { latitude: -23.55, longitude: -46.63, altitude: null }
          }
        ],
        'jpeg'
      );
    app = await require('playwright')._electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ]
    });
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900));
    const { waitForAsync } = require('../tests/fixtures/wait-for-async.cjs');
    await page.locator('[data-view="checker"]').click();
    await page
      .locator('#checker-input')
      .fill(
        'https://www.facebook.com/Meta\nhttps://www.facebook.com/NASA\nhttps://www.facebook.com/zuck'
      );
    await page.locator('[data-action="checker-run"]').click();
    await waitForAsync(
      page,
      async () => {
        const { state } = await import('/js/state.js');
        return (
          !state.checker.checking &&
          state.checker.rows?.length === 3 &&
          state.checker.rows.every((r) => r.check)
        );
      },
      undefined,
      { timeout: 90000 }
    );
    const checks = await page.evaluate(async () =>
      (await import('/js/state.js')).state.checker.rows.map((r) => r.check)
    );
    const { facebookPresentation } = await import('../shared/facebook-presentation.mjs');
    report.facebook = {
      status: checks.some((r) => facebookPresentation(r).status === 'LIVE') ? 'PASS' : 'BLOCKED',
      targets: checks.map((r) => ({
        target: r.canonicalUrl,
        result: facebookPresentation(r).status,
        reason: r.reasonCode,
        httpStatus: r.httpStatus,
        checkedAt: r.checkedAt,
        durationMs: r.durationMs,
        diagnostics: r.diagnostics
      })),
      scope:
        'Actual BLEGO Checker UI and check.fb.tools third-party service, with no mocked request. LIVE denotes the provider classification, not confirmation of Meta account standing.',
      confirmedUnavailableTarget: 'BLOCKED: no independently confirmed unavailable target supplied'
    };
    await page.screenshot({ path: path.join(path.dirname(out), 'tz11-checker-live.png') });

    report.trustProvider = await app.evaluate(async ({ app }) => {
      const require = process
        .getBuiltinModule('node:module')
        .createRequire(app.getAppPath() + '/package.json');
      const ip = '8.8.8.8';
      const provider =
        require('./electron/features/proxy/proxycheck.cjs').createProxycheckProvider();
      const sources = await require('./electron/features/proxy/providers.cjs').lookupProviders(
        ip,
        [provider],
        new AbortController().signal
      );
      const assessment = require('./electron/features/proxy/assessment.cjs').assess(sources, ip);
      return {
        status: assessment.score === null ? 'BLOCKED' : 'PASS',
        sampleIp: ip,
        sources,
        assessment,
        scope:
          'Explicit QA lookup of one fixed public DNS IP using the app provider adapter, without keys or proxy credentials. This is provider evidence, not proof of a user proxy route.'
      };
    });
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(distinctCopies(photo, 20));
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.photos.length === 20;
    });
    await page.locator('#photo-map-canvas').scrollIntoViewIfNeeded();
    const capture = async (mode, filename) => {
      let failure = null;
      try {
        await page.waitForFunction(
          () => {
            const c = document.getElementById('photo-map-canvas'),
              a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            const colors = new Set();
            for (let i = 0; i < a.length; i += 64) colors.add(`${a[i]},${a[i + 1]},${a[i + 2]}`);
            return (
              Number(c.dataset.requiredTiles) > 0 &&
              c.dataset.tiles === c.dataset.requiredTiles &&
              colors.size > 32
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
        (mode === 'before'
          ? Math.abs(evidence.center.latitude + 23.55) < 0.01 &&
            Math.abs(evidence.center.longitude + 46.63) < 0.01
          : evidence.center.latitude > 41 &&
            evidence.center.latitude < 43 &&
            evidence.center.longitude > 11 &&
            evidence.center.longitude < 14) && evidence.tiles.every((t) => t.z >= 8);
      const result = {
        status:
          !city || evidence.points !== 20 || !evidence.required
            ? 'FAIL'
            : failure
              ? evidence.rendered < evidence.required
                ? 'BLOCKED'
                : 'FAIL'
              : 'PASS',
        reason: failure || (!city ? 'WRONG_CITY_VIEW' : null),
        ...evidence,
        scope:
          'Actual OSM city viewport and Canvas pixels in Electron; synthetic 20-photo GPS plan, no metadata sent to provider'
      };
      await page.locator('.photo-map').screenshot({ path: path.join(path.dirname(out), filename) });
      if (result.status === 'FAIL') process.exitCode = 1;
      return result;
    };
    report.mapBefore = await capture('before', 'map-live-sao-paulo.png');
    await page.locator('#geo-country').fill('IT');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city').selectOption('osm:relation:41485');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && !state.geoBusy && state.photoMap.mode === 'after';
    });
    report.map = await capture('after', 'map-live-rome.png');
  } catch (e) {
    report.error = /^[A-Z_]+$/.test(e.message) ? e.message : 'LIVE_CHECK_FAILED';
    report.map.status = 'FAIL';
    process.exitCode = 1;
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
