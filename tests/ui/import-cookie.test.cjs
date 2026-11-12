const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');

test(
  'one-click copy retrieves the full synthetic cookie from the correct imported row',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-cookie-copy-'));
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${path.join(root, 'data')}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await page.evaluate(() => window.blego.markTour()).catch(() => {});
    const rawCookie = 'FAKE_COOKIE_' + 'x'.repeat(1200);
    const second = 'FAKE_COOKIE_' + 'y'.repeat(1005);
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic-only.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from(`id\tcookies\nrow-one\t${rawCookie}\nrow-two\t${second}`, 'utf8')
    });
    const controls = page.locator('[data-action="import-cookie-copy"]');
    await controls.first().waitFor();
    assert.equal(await controls.count(), 2);
    const display = await controls
      .first()
      .evaluate((button) => button.previousElementSibling.textContent);
    assert.ok(display.length <= 13, 'the visual preview must remain short');
    assert.notEqual(display, rawCookie);
    await controls.nth(1).click();
    let copied = '';
    for (let attempt = 0; attempt < 100; attempt++) {
      copied = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (copied === second) break;
      await page.waitForTimeout(20);
    }
    assert.equal(copied, second);
    await controls.first().click();
    for (let attempt = 0; attempt < 100; attempt++) {
      copied = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (copied === rawCookie) break;
      await page.waitForTimeout(20);
    }
    assert.equal(copied, rawCookie);
  }
);
