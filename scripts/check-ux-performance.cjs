const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const args = process.argv.slice(2),
  get = (k) => args[args.indexOf(k) + 1];
const original = get('--original'),
  executable = args.includes('--executable') ? get('--executable') : undefined;
const reportPath = args.includes('--report') ? get('--report') : 'release/ux-performance.json';
(async () => {
  if (!args.includes('--original')) throw Error('Pass --original checkout path');
  const output = path.dirname(reportPath);
  fs.mkdirSync(output, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    os: process.platform,
    arch: process.arch,
    release: os.release(),
    method:
      'Three isolated launches per version; visible Electron window, local generation; renderer /api requests blocked for comparable offline observations. Not a scientific cold-cache benchmark.',
    versions: []
  };
  for (const [label, project, binary] of [
    ['original', original, undefined],
    ['candidate', process.cwd(), executable]
  ]) {
    const samples = [];
    for (let sample = 0; sample < 3; sample++) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-perf-')),
        started = performance.now();
      let app;
      try {
        app = await _electron.launch({
          executablePath: binary,
          args: [
            ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--disable-gpu'] : []),
            ...(binary ? [] : [project]),
            `--user-data-dir=${root}`
          ]
        });
        await app.context().route('**/api/**', (route) => route.abort());
        const page = await app.firstWindow();
        await page.locator('[data-action="generate"]').first().waitFor();
        const launchMs = performance.now() - started;
        await app.evaluate(({ BrowserWindow }) => {
          const w = BrowserWindow.getAllWindows()[0];
          w.setBounds({ width: 1280, height: 900 });
          w.focus();
        });
        const skip = page.locator('[data-tour-action="skip"]');
        if (await skip.isVisible()) await skip.click();
        const generationStart = performance.now();
        await page.locator('[data-action="generate"]').first().click();
        await page.locator('.demo-card').waitFor();
        const generationMs = performance.now() - generationStart;
        await page.waitForTimeout(900);
        if (await skip.isVisible()) await skip.click();
        const frames = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const gaps = [];
              let previous;
              function frame(at) {
                if (previous !== undefined) gaps.push(at - previous);
                previous = at;
                if (gaps.length < 120) requestAnimationFrame(frame);
                else resolve(gaps);
              }
              requestAnimationFrame(frame);
            })
        );
        frames.sort((a, b) => a - b);
        samples.push({
          launchMs: Math.round(launchMs),
          generationMs: Math.round(generationMs),
          frameMedianMs: frames[Math.floor(frames.length / 2)],
          frameP95Ms: frames[Math.floor(frames.length * 0.95)],
          frameMaxMs: frames.at(-1)
        });
        if (sample === 0) {
          for (const [width, height] of [
            [1280, 900],
            [980, 720]
          ]) {
            await app.evaluate(
              ({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds),
              { width, height }
            );
            for (const view of [
              'generator',
              'network',
              'news',
              'checker',
              'photos',
              'history',
              'import'
            ]) {
              const nav = page.locator(`[data-view="${view}"]`).first();
              if (!(await nav.count())) continue;
              await nav.click();
              await page.waitForTimeout(650);
              await page.screenshot({
                path: path.join(output, `ux-${label}-${view}-${width}.png`)
              });
            }
          }
        }
      } finally {
        if (app) await app.close();
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
    report.versions.push({ label, samples });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
