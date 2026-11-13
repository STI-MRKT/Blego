const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'TZ06 saving a new classified TXT opens a fresh archive list even after viewing an older entry, and survives restart',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-archive141-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    store.close();
    let app;
    const launch = async () => {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${data}`
        ]
      });
      return app.firstWindow();
    };
    t.after(async () => {
      await app?.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    let page = await launch();
    for (const [i, name] of ['Old.txt', 'New.txt'].entries()) {
      await page.locator('[data-view="import"]').click();
      if (i) await page.locator('[data-action="import-reset"]').click();
      const source = path.join(root, name);
      fs.writeFileSync(
        source,
        `id:000${i + 1}|name:Synthetic Person|email:person${i}@example.test|password:FAKE|GEO IT` +
          (i ? '\nid:999|name:Other Person|email:excluded@example.test|password:FAKE|GEO US' : '')
      );
      await page.locator('#file-input').setInputFiles(source);
      await page.locator('[data-classifier-status]').waitFor();
      // Earlier successful saves may still have visible notifications. Observe this save only.
      await page.locator('#toasts .toast').evaluateAll((items) => {
        for (const item of items) item.dataset.beforeArchiveSave = 'true';
      });
      if (i) {
        await page.locator('[data-action="classifier-details"][data-row="1"]').click();
        await page.locator('[data-action="classifier-archive-record"]').click();
      } else {
        await page.locator('#classifier-extra summary').click();
        await page.locator('[data-action="classifier-archive"]').click();
      }
      await page
        .locator('#toasts .toast:not([data-before-archive-save])')
        .getByText('Сохранено', { exact: true })
        .waitFor();
      assert.ok(fs.existsSync(source));
      await page.locator('[data-view="history"]').click();
      await page.locator('.hrow .nm').filter({ hasText: name }).waitFor({ timeout: 5000 });
      await page.locator('.hrow .nm').filter({ hasText: name }).click();
      assert.ok(
        (await page.locator('pre').first().textContent()).includes(`person${i}@example.test`)
      );
    }
    await app.close();
    app = null;
    page = await launch();
    await page.locator('[data-view="history"]').click();
    await page.locator('.hrow .nm').filter({ hasText: 'New.txt' }).click();
    assert.ok((await page.locator('pre').first().textContent()).includes('person1@example.test'));
    assert.ok(!(await page.locator('pre').first().textContent()).includes('excluded@example.test'));
    assert.equal((await page.evaluate(() => window.blego.listArchives())).total, 2);
  }
);
