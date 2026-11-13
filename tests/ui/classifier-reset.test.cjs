const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'discard invalidates raw import snapshots and prepared clipboard payloads',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-classifier-ui-'));
    const store = await openStore(path.join(root, 'data'));
    store.set('tourSeen', true);
    store.close();
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
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from('id\tcookies\n0001\tFAKE_COOKIE_DISCARDED')
    });
    await page.locator('[data-classifier-status]').waitFor();
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+Alt+Shift+C');
    await page.locator('[data-copy-control="source"]').selectOption('import-source');
    await page.locator('[data-copy-control="personal"]').check();
    await page.locator('[data-copy-action="preview"]').click();
    await page
      .locator('#copy-preview')
      .getByText(/FAKE_COOKIE_DISCARDED/)
      .waitFor();
    await page.locator('[data-action="import-reset"]').click();
    assert.equal(await page.locator('[data-copy-control="format"]').count(), 0);
    assert.ok(!(await page.locator('body').textContent()).includes('FAKE_COOKIE_DISCARDED'));
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Control+Alt+Shift+C');
    await page.locator('[data-copy-control="source"]').selectOption('import-source');
    await page.locator('[data-copy-control="personal"]').check();
    await page.locator('[data-copy-action="preview"]').click();
    assert.ok(
      !(await page.locator('#copy-preview').textContent()).includes('FAKE_COOKIE_DISCARDED')
    );
  }
);
