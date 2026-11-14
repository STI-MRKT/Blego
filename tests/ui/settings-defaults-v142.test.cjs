const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ9 fresh UI enables three tools; disabling one survives restart without changing others',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-fresh-settings-'));
    const launch = () =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${root}`
        ]
      });
    let app = await launch();
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    let page = await app.firstWindow();
    await page.locator('[data-view="settings"]').click();
    for (const key of ['proxyEnabled', 'facebookEnabled', 'newsEnabled'])
      assert.ok(await page.locator(`[name="${key}"]`).isChecked(), key);
    await page.locator('[name="facebookEnabled"]').uncheck();
    await page.locator('#settings-form button[type="submit"]').click();
    await waitForAsync(page, async () => !(await window.blego.getSettings()).facebookEnabled);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.locator('[data-view="settings"]').click();
    assert.ok(!(await page.locator('[name="facebookEnabled"]').isChecked()));
    for (const key of ['proxyEnabled', 'newsEnabled'])
      assert.ok(await page.locator(`[name="${key}"]`).isChecked());
    if (process.env.BLEGO_CAPTURE)
      await page.screenshot({
        path: path.join(process.env.BLEGO_CAPTURE, 'tz9-settings-persisted.png')
      });
  }
);
