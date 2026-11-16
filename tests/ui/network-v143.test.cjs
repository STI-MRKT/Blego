const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
test(
  'TZ11 Trust consent is requested once, survives restart and cannot be forged through settings IPC',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-trust-'));
    let app;
    t.after(async () => {
      if (app) await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const launch = async (directory) =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${directory}`
        ]
      });
    for (const choice of [0, 1]) {
      const directory = path.join(root, String(choice));
      app = await launch(directory);
      await app.evaluate(({ dialog }, choice) => {
        globalThis.trustPrompts = 0;
        dialog.showMessageBox = async (_window, options) => {
          globalThis.trustPrompts++;
          if (!options.detail.includes('только выходной IP')) throw Error('NOTICE_MISSING');
          return { response: choice };
        };
      }, choice);
      let page = await app.firstWindow();
      await page.locator('[data-view="network"]').click();
      assert.equal(await page.locator('#proxy-reputation').count(), 0);
      const forged = await page.evaluate(async () => {
        try {
          await window.blego.updateSettings({ proxyReputationConsent: true });
          return false;
        } catch {
          return true;
        }
      });
      assert.equal(forged, true);
      await page.locator('#proxy-input').fill('http://127.0.0.1:80');
      for (let i = 0; i < 2; i++) {
        await page.locator('[data-action="proxy-check"]').click();
        await page.getByText('Network Error', { exact: true }).waitFor();
      }
      assert.equal(await app.evaluate(() => globalThis.trustPrompts), 1);
      assert.equal(
        await page.evaluate(async () => (await window.blego.getSettings()).proxyReputationConsent),
        choice === 1
      );
      await app.close();
      app = null;
      app = await launch(directory);
      await app.evaluate(({ dialog }) => {
        globalThis.trustPrompts = 0;
        dialog.showMessageBox = async () => {
          globalThis.trustPrompts++;
          return { response: 0 };
        };
      });
      page = await app.firstWindow();
      await page.locator('[data-view="network"]').click();
      await page.locator('#proxy-input').fill('http://127.0.0.1:80');
      await page.locator('[data-action="proxy-check"]').click();
      await page.getByText('Network Error', { exact: true }).waitFor();
      assert.equal(await app.evaluate(() => globalThis.trustPrompts), 0);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 800));
      assert.equal(await page.locator('[data-action="proxy-check"]').isVisible(), true);
      if (process.env.BLEGO_CAPTURE)
        await page.screenshot({
          path: path.join(process.env.BLEGO_CAPTURE, `tz11-network-${choice}.png`)
        });
      await app.close();
      app = null;
    }
  }
);
