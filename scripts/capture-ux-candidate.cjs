// QA only: disposable synthetic data, identical window/theme, real Electron rendering.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { _electron } = require('playwright');
const { imageFixture } = require('../tests/fixtures/images.cjs');
(async () => {
  const args = process.argv.slice(2),
    get = (k) => args[args.indexOf(k) + 1];
  for (const k of ['--root', '--label', '--out'])
    if (!args.includes(k)) throw Error('Missing ' + k);
  const root = path.resolve(get('--root')),
    label = get('--label'),
    out = path.resolve(get('--out'));
  const original = label === 'original',
    data = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-visual-'));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(data, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
  const executable =
    process.env.BLEGO_EXECUTABLE ||
    path.join(
      root,
      'node_modules/electron/dist',
      process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'
    );
  const report = {
    label,
    sourceSha: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    host: process.platform + '-' + process.arch,
    os: os.release(),
    at: new Date().toISOString(),
    window: { width: 1280, height: 900 },
    errors: [],
    metrics: {},
    screens: [],
    scope:
      'Synthetic local rendering; external requests blocked for comparable visual audit. Timings include automation overhead; no statistical performance claim.'
  };
  let app;
  try {
    const start = performance.now();
    app = await _electron.launch({
      executablePath: executable,
      cwd: root,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : [root]),
        `--user-data-dir=${data}`
      ]
    });
    await app.context().route('**/*', (r) => {
      const u = new URL(r.request().url());
      return u.hostname === '127.0.0.1' && !u.pathname.startsWith('/api/')
        ? r.continue()
        : r.abort();
    });
    const page = await app.firstWindow();
    page.on('pageerror', (e) => report.errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.locator('[data-action="generate"]').first().waitFor();
    report.metrics.firstUsableMs = performance.now() - start;
    async function capture(name, settle = 650) {
      await page.waitForTimeout(settle);
      await page.screenshot({ path: path.join(out, `${label}-${name}.png`) });
      report.screens.push({
        name,
        ...(await page.evaluate(() => ({
          theme: document.documentElement.dataset.theme || 'default',
          viewport: { width: innerWidth, height: innerHeight },
          animations: document.getAnimations().map((a) => ({
            name: a.animationName || a.transitionProperty,
            playState: a.playState,
            duration: a.effect.getTiming().duration,
            target: a.effect.target.className
          }))
        })))
      });
    }
    await capture('generator-empty');
    await page.locator('[data-action="generate"]').first().hover();
    await capture('generator-hover');
    const generateStart = performance.now();
    await page.locator('[data-action="generate"]').first().click();
    await capture('generator-loading', 0);
    await page.locator('.demo-card').waitFor();
    report.metrics.generateMs = performance.now() - generateStart;
    await capture('generator-result');
    for (const view of ['network', 'news', 'checker', 'photos', 'history', 'settings', 'import']) {
      const nav = page.locator(`[data-action="set-view"][data-view="${view}"]`).first();
      if (!(await nav.count())) continue;
      const start = performance.now();
      await nav.click();
      await page.locator('#view .page').waitFor();
      report.metrics[view + 'NavigationMs'] = performance.now() - start;
      await capture(view);
      if (view === 'network')
        report.metrics.networkFrameIntervalsMs = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const values = [];
              let previous;
              function frame(t) {
                if (previous !== undefined) values.push(t - previous);
                previous = t;
                if (values.length === 60) resolve(values);
                else requestAnimationFrame(frame);
              }
              requestAnimationFrame(frame);
            })
        );
      if (view === 'photos') {
        const file = await imageFixture(data, 'png');
        const start = performance.now();
        if (original) await page.locator('#photo-input').setInputFiles(file);
        else {
          await app.evaluate(({ dialog }, file) => {
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
          }, file);
          await page.locator('[data-action="images-choose"]').click();
        }
        await page.locator('.photo-grid .ph img').first().waitFor();
        report.metrics.photoThumbnailMs = performance.now() - start;
        await capture('photos-loaded');
      }
    }
    report.electron = await app.evaluate(() => process.versions.electron);
    if (report.errors.length) throw Error('Renderer errors');
    report.status = 'PASS';
  } catch (e) {
    report.status = 'FAIL';
    report.failure = e.message;
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    fs.rmSync(data, { recursive: true, force: true });
    fs.writeFileSync(path.join(out, `${label}-audit.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(label, report.status, report.failure || '');
  }
})();
