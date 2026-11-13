const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
test(
  'proxy UI keeps original gauge, plaintext input, explicit reputation and honest blocked result',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-proxy-ui-'));
    let releaseResponse = () => {};
    const store = await require('../../electron/local/store.cjs').openStore(root);
    store.set('tourSeen', true);
    store.close();
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    t.after(async () => {
      releaseResponse();
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="network"]').click();
    assert.equal(await page.locator('.gauge').isVisible(), true);
    assert.equal(await page.locator('#proxy-input').getAttribute('type'), 'text');
    assert.equal(await page.locator('#proxy-reputation').isChecked(), false);
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.settings = await window.blego.updateSettings({ proxyEnabled: true });
    });
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-view="network"]').click();
    await page.locator('#proxy-input').fill('http://user:synthetic-password@127.0.0.1:80');
    await page.locator('[data-action="proxy-check"]').click();
    await page.getByText('Network Error', { exact: true }).waitFor();
    assert.match(await page.locator('.proxy-result').innerText(), /Request blocked/);
    assert.doesNotMatch(await page.locator('.proxy-result').innerText(), /synthetic-password/);
    assert.equal(
      await page
        .locator('.risk-score')
        .allTextContents()
        .then((x) => x.every((v) => v === 'N/A')),
      true
    );
    await page.locator('#proxy-input').fill('http://new.example:8080');
    assert.equal(await page.locator('.proxy-result').count(), 0);
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('local:proxyCheck');
      ipcMain.handle('local:proxyCheck', (_event, request) => ({
        ok: true,
        value: {
          connection: 'ok',
          exitIp: '203.0.113.2',
          timings: {},
          sources: [],
          assessment: { score: null },
          quality: { score: null },
          speed: request.fullTest ? { mbps: 10.5, bytes: 3000000, ttfb: 25 } : null
        }
      }));
    });
    await page.locator('[data-action="proxy-speed"]').click();
    await page.waitForFunction(
      () => document.querySelector('#speed-value')?.dataset.value === '10.5'
    );
    assert.equal(await page.getByText('Proxy Speed', { exact: true }).isVisible(), true);
    let resolveStarted;
    const started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    const response = new Promise((resolve) => {
      releaseResponse = resolve;
    });
    let resolveFinished;
    const finished = new Promise((resolve) => {
      resolveFinished = resolve;
    });
    await page.route('**/api/net/speed', async (route) => {
      resolveStarted();
      await response;
      await route
        .fulfill({ json: { mbps: 999, bytes: 1, ttfb: 1 } })
        .catch(() => {})
        .finally(resolveFinished);
    });
    await page.locator('[data-action="net-run"]').click();
    await started;
    await page.waitForTimeout(650); // Deliberately slower than the old 400ms fixture.
    await page.locator('[data-action="net-cancel"]').click();
    releaseResponse();
    await finished;
    await page.waitForFunction(async () => !(await import('/js/state.js')).state.network.running);
    const state = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return {
        running: state.network.running,
        error: state.network.error,
        speed: state.network.speed
      };
    });
    assert.equal(state.running, false);
    assert.equal(state.speed, null);
    assert.equal(state.error, 'Check cancelled.');
  }
);
test(
  'first-run tour never steals navigation after the user starts working',
  { timeout: 15000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tour-navigation-'));
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="network"]').click();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.gauge').count(), 1);
    assert.equal(await page.locator('#tour-root').count(), 0);
  }
);
