// Explicit synthetic 100-file GUI load check, not part of each quick regression run.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../tests/fixtures/images.cjs');
const { openStore } = require('../electron/local/store.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-ui-batch-')),
    data = path.join(root, 'data'),
    output = path.join(root, 'output');
  fs.mkdirSync(output);
  const store = await openStore(data);
  store.set('tourSeen', true);
  store.close();
  const file = await imageFixture(root, 'png');
  let app;
  try {
    app = await _electron.launch({
      args: ['--ozone-platform=headless', '--disable-gpu', '.', `--user-data-dir=${data}`],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(root, 'config'),
        XDG_CACHE_HOME: path.join(root, 'cache')
      }
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="photos"]').click();
    await page.evaluate(() => {
      globalThis.__batch = { ticks: 0, maxGapMs: 0, last: performance.now() };
      globalThis.__batchTimer = setInterval(() => {
        const now = performance.now();
        __batch.ticks++;
        __batch.maxGapMs = Math.max(__batch.maxGapMs, now - __batch.last);
        __batch.last = now;
      }, 25);
    });
    const started = Date.now();
    const choose = async (paths) =>
      app.evaluate(({ dialog }, paths) => {
        const original = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => {
          dialog.showOpenDialog = original;
          return { canceled: false, filePaths: paths };
        };
      }, paths);
    await choose(Array(100).fill(file));
    await page.locator('[data-action="images-choose"]').click();
    await page.waitForFunction(
      async () => {
        const { state } = await import('/js/state.js');
        return state.photos.length === 100 && !state.imagesBusy;
      },
      null,
      { timeout: 180000 }
    );
    const reads = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.photos.filter((p) => p.status === 'ready').length;
    });
    if (reads !== 100) throw Error(`Read count ${reads}`);
    console.log('100 files read');
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('Synthetic GUI batch');
    await page.locator('#metadata-form [type="submit"]').click();
    await page.locator('[data-action="metadata-export"]').waitFor();
    await choose([output]);
    await page.locator('[data-action="metadata-export"]').click();
    await page.waitForFunction(
      async () => {
        const { state } = await import('/js/state.js');
        return Boolean(state.metadataExport) && !state.imagesBusy;
      },
      null,
      { timeout: 180000 }
    );
    const report = await page.evaluate(async () => {
      clearInterval(__batchTimer);
      const { state } = await import('/js/state.js');
      return {
        ticks: __batch.ticks,
        maxEventLoopGapMs: Math.round(__batch.maxGapMs),
        results: state.metadataExport.files.map((f) => f.status),
        progressRows: Object.keys(state.metadataProgress).length
      };
    });
    const completed = report.results.filter((s) => s === 'completed').length;
    if (completed !== 100 || report.progressRows !== 100) throw Error(JSON.stringify(report));
    console.log(
      JSON.stringify(
        {
          files: 100,
          reads,
          completed,
          outputFiles: fs.readdirSync(output).length,
          elapsedSeconds: (Date.now() - started) / 1000,
          eventLoopTicks: report.ticks,
          maxEventLoopGapMs: report.maxEventLoopGapMs,
          progressRows: report.progressRows,
          fixture: '12×8 RGBA PNG; not maximum-size stress'
        },
        null,
        2
      )
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
