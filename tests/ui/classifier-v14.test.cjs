const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { formatA, formatB, cookie } = require('../fixtures/classifier-v14.cjs');
test(
  'classifier masks secrets, explains a row, assigns locally and copies exact values',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-v14-classifier-'));
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
      name: 'synthetic.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(formatA() + '\n' + formatB())
    });
    await page.locator('[data-classifier-status]').waitFor();
    assert.ok(
      (await page.locator('.classifier-table').innerText()).includes('FAKE_ACCOUNT_PASSWORD')
    );
    assert.ok(
      !(await page.locator('.classifier-page').innerHTML()).includes('FAKE_UNASSIGNED_PASSWORD')
    );
    const details = page.locator('[data-action="classifier-details"][data-row="2"]');
    assert.equal(await details.count(), 1);
    await details.click();
    assert.ok(
      (await page.locator('#classifier-record-details').innerText()).includes(
        'Остались нераспознанные значения'
      )
    );
    await page.locator('#classifier-record-details details summary').first().click();
    const select = page.locator('[data-classifier-row-map][data-row="2"][data-column="column_2"]');
    await select.selectOption('password');
    await page.locator('[data-action="classifier-apply-record"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-classifier-status]')?.dataset.classifierStatus ===
        'preview_complete'
    );
    await page.locator('[data-action="classifier-details"][data-row="2"]').click();
    await page.locator('[data-action="classifier-reveal"][data-field="password"]').click();
    assert.ok(
      (await page.locator('#classifier-record-details').innerText()).includes(
        'FAKE_UNASSIGNED_PASSWORD'
      )
    );
    await page.locator('[data-action="classifier-reveal"][data-field="password"]').click();
    assert.ok(
      !(await page.locator('#classifier-record-details').innerHTML()).includes(
        'FAKE_UNASSIGNED_PASSWORD'
      )
    );
    assert.ok(
      (await page.locator('.classifier-table').innerText()).includes('FAKE_UNASSIGNED_PASSWORD')
    );
    await page
      .locator('.classifier-table [data-action="import-cookie-copy"][data-row="2"]')
      .click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), cookie('00010002'));
    await page.locator('#classifier-warnings-only').check();
    await page.waitForFunction(
      () => document.querySelectorAll('.classifier-table tbody tr').length === 0
    );
    await page.locator('[data-action="import-reset"]').click();
    assert.equal(await page.locator('#classifier-record-details').count(), 0);
  }
);
