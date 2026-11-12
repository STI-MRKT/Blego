const { waitForAsync } = require('../tests/fixtures/wait-for-async.cjs');
// Explicit synthetic 100-file GUI load check, not part of each quick regression run.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture, distinctCopies } = require('../tests/fixtures/images.cjs');
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
  const mixed = process.argv.includes('--mixed');
  let inputFiles;
  if (mixed) {
    const big = path.join(root, '40MP.png');
    await require('sharp')({
      create: {
        width: 8000,
        height: 5000,
        channels: 4,
        background: { r: 70, g: 110, b: 150, alpha: 0.6 }
      }
    })
      .png()
      .toFile(big);
    const bytes = fs.readFileSync(file),
      chunk = Buffer.alloc(49 * 1024 * 1024 - bytes.length);
    chunk.writeUInt32BE(chunk.length - 12);
    chunk.write('npAD', 4, 'ascii');
    chunk.writeUInt32BE(require('node:zlib').crc32(chunk.subarray(4, -4)), chunk.length - 4);
    const padded = path.join(root, '49MiB.png');
    fs.writeFileSync(padded, Buffer.concat([bytes.subarray(0, -12), chunk, bytes.subarray(-12)]));
    inputFiles = [file, big, padded];
  } else inputFiles = distinctCopies(file, 100);
  const expected = inputFiles.length;
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
    await choose(inputFiles);
    await page.locator('[data-action="images-choose"]').click();
    await waitForAsync(
      page,
      async (expected) => {
        const { state } = await import('/js/state.js');
        return state.photos.length === expected && !state.imagesBusy;
      },
      expected,
      { timeout: 180000 }
    );
    const reads = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.photos.filter((p) => p.status === 'ready').length;
    });
    if (reads !== expected) {
      const statuses = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return state.photos.slice(0, 3).map((p) => ({ status: p.status, error: p.error }));
      });
      throw Error(
        `Read count ${reads}: ${JSON.stringify(statuses)}; toasts=${await page.locator('.toasts').textContent()}`
      );
    }
    console.log(`${expected} files read`);
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('Synthetic GUI batch');
    await choose([output]);
    await page.locator('#metadata-form [type="submit"]').click();
    await page.locator('[data-action="metadata-export"]').waitFor();
    await page.locator('[data-action="metadata-export"]').click();
    await waitForAsync(
      page,
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
    if (completed !== expected || report.progressRows !== expected)
      throw Error(JSON.stringify(report));
    console.log(
      JSON.stringify(
        {
          files: expected,
          reads,
          completed,
          outputFiles: fs.readdirSync(output).length,
          elapsedSeconds: (Date.now() - started) / 1000,
          eventLoopTicks: report.ticks,
          maxEventLoopGapMs: report.maxEventLoopGapMs,
          progressRows: report.progressRows,
          fixture: mixed
            ? 'Mixed 12×8 RGBA, 40MP RGBA and 49MiB valid PNG with ancillary padding'
            : '12×8 RGBA PNG; not maximum-size stress'
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
