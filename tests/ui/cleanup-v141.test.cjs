const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'TZ06 cleanup retains settings access and exact cookie reveal closes only after successful copy',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-ui-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    store.close();
    let app;
    async function launch() {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${data}`
        ]
      });
      return app.firstWindow();
    }
    t.after(async () => {
      await app?.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    let page = await launch();
    await page.locator('.topbar [data-view="settings"]').waitFor();
    assert.equal(await page.locator('.sidebar [data-view="settings"]').count(), 0);
    assert.equal(await page.locator('.topbar [data-view="settings"]').count(), 1);
    await page.locator('[data-view="import"]').click();
    assert.equal(await page.getByText('Формат файла', { exact: true }).count(), 0);
    const cookie = '[ { "name" : "synthetic", "value" : "FAKE_' + 'x'.repeat(12000) + '" } ]';
    await page.locator('#file-input').setInputFiles({
      name: 'cookies.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('id:0001|cookies:' + cookie)
    });
    await page.locator('[data-classifier-status]').waitFor();
    const toggle = page.locator('[data-action="classifier-cookie-toggle"][data-row="1"]');
    assert.equal(await page.locator('[data-cookie-full]').count(), 0);
    await toggle.click();
    assert.equal(await page.locator('[data-cookie-full]').textContent(), cookie);
    await page.locator('[data-action="import-cookie-copy"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-cookie-full]'));
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), cookie);
    await toggle.click();
    await app.evaluate(({ clipboard }) => {
      globalThis.savedClipboardWrite = clipboard.writeText;
      clipboard.writeText = () => {
        throw Error('denied');
      };
    });
    await page.locator('[data-action="import-cookie-copy"]').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-cookie-full]').textContent(), cookie);
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = globalThis.savedClipboardWrite;
    });
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-view="import"]').click();
    assert.equal(await page.locator('[data-cookie-full]').count(), 0);
  }
);
