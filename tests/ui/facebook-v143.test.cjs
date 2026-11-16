const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ11 public-page content without JSON-LD renders truthful results and full target diagnostics',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-fb-status-'));
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
    // The service and evidence inspector run unchanged, with controlled transport.
    await app.evaluate(({ app, ipcMain, BrowserWindow }) => {
      const require = process
        .getBuiltinModule('node:module')
        .createRequire(app.getAppPath() + '/package.json');
      const { validateSender } = require('./electron/local/ipc.cjs');
      let now = Date.now();
      const service = require('./electron/features/facebook/service.cjs').createFacebookService({
        clock: {
          now: () => now,
          sleep: async (ms) => {
            now += ms;
          }
        },
        transport: async (url) => {
          now += 10;
          const id = new URL(url).searchParams.get('id');
          if (id === '123')
            return {
              url,
              status: 200,
              body: `<html><head><link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><meta property="og:title" content="Synthetic Public Page"><meta property="og:description" content="A public science organization sharing space research and community events."></head><body><h1>Synthetic Public Page</h1><p>A public science organization sharing space research and community events.</p></body></html>`
            };
          if (id === '456') return { url, status: 200, body: "<h1>Content isn't available</h1>" };
          if (id === '789') return { url, status: 403, body: '' };
          if (id === '1000')
            throw Object.assign(Error('SYNTHETIC_PRIVATE_DETAIL'), { code: 'ENOTFOUND' });
          return { url, status: 200, body: '<form id="login_form">' };
        }
      });
      ipcMain.removeHandler('local:facebookCheck');
      ipcMain.handle('local:facebookCheck', async (event, request) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (!validateSender(event, win.webContents, win.webContents.getURL()))
          throw Error('UNTRUSTED_IPC');
        const results = [];
        for await (const row of service.check(request)) results.push(row);
        return { ok: true, value: { results } };
      });
    });
    await page.locator('[data-view="checker"]').click();
    await page
      .locator('#checker-input')
      .fill('123\nhttps://www.facebook.com/profile.php?id=456\n789\n1000\n1001');
    await page.locator('[data-action="checker-run"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.checker.checking && state.checker.rows?.every((r) => r.check);
    });
    assert.deepEqual(
      await page
        .locator('[data-checker-status]')
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.checkerStatus)),
      ['ACTIVE', 'BLOCKED', 'UNKNOWN', 'NETWORK_ERROR', 'LOGIN_REQUIRED']
    );
    assert.equal(await page.locator('[data-checker-status="ACTIVE"].ok').count(), 1);
    assert.equal(await page.locator('[data-checker-status="BLOCKED"].err').count(), 1);
    assert.equal(
      await page
        .locator('[data-checker-status="UNKNOWN"].ok, [data-checker-status="NETWORK_ERROR"].err')
        .count(),
      0
    );
    await page
      .locator('.checker-row')
      .first()
      .getByRole('button', { name: 'Copy check result', exact: true })
      .click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'ACTIVE');
    const before = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.checker.rows[0].check.checkedAt;
    });
    await page.locator('[data-action="checker-retry-one"]').first().click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.checker.checking && !!state.checker.rows[0].check;
    });
    const after = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.checker.rows[0].check.checkedAt;
    });
    assert.ok(after > before);
    assert.equal(await page.locator('.checker-row').count(), 5);
    assert.ok(!(await page.locator('body').textContent()).includes('SYNTHETIC_PRIVATE_DETAIL'));
    assert.ok(
      (await page.locator('body').textContent()).includes('Проверка доступности Facebook-профилей')
    );
    const detail = page.locator('.checker-row').first().locator('details');
    await detail.locator('summary').click();
    assert.ok((await detail.textContent()).includes('Исходный ввод: 123'));
    assert.ok(
      (await detail.textContent()).includes(
        'Нормализованный URL: https://www.facebook.com/profile.php?id=123'
      )
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.locator('#view').evaluate((view) => {
      view.scrollTop = 0;
    });
    await page.waitForTimeout(2800);
    if (process.env.BLEGO_CAPTURE)
      await page.screenshot({
        path: path.join(process.env.BLEGO_CAPTURE, 'tz11-facebook-statuses.png'),
        fullPage: true
      });
  }
);
