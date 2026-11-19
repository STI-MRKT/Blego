const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');

test('TZ31: explicit whole-column copy collects all 63 rows; search, order and backup email work', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz31-column-'));
  const data = path.join(root, 'data');
  const store = await openStore(data);
  store.set('tourSeen', true);
  store.close();
  const app = await _electron.launch({
    executablePath: process.env.BLEGO_EXECUTABLE || undefined,
    args: [
      ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
      ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
      `--user-data-dir=${data}`
    ]
  });
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const page = await app.firstWindow();
  const records = Array.from({length: 63}, (_, index) => ({
    fullName: `Group ${index % 10 === 0 ? 'A' : 'B'} Person ${String(index).padStart(3, '0')}`,
    accountId: String(615000000000000 + index),
    email: `test${index}@example.test`,
    backupEmail: `backup${index}@example.test`,
    geo: 'US'
  }));
  await page.locator('[data-view="import"]').click();
  await page.locator('#file-input').setInputFiles({
    name: 'only-synthetic-names.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(records))
  });
  await page.locator('[data-classifier-status]').waitFor();
  const field = page.locator('#classifier-copy-field');
  const copyButton = page.locator('#classifier-copy-column-button');
  assert.equal(await field.count(), 1);
  assert.equal(await copyButton.isVisible(), true);
  assert.ok((await page.locator('.classifier-table [data-action="classifier-copy-column"]').count()) > 1);

  async function expectClipboard(value) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const actual = await app.evaluate(({clipboard}) => clipboard.readText());
      if (actual === value) return;
      await page.waitForTimeout(50);
    }
    assert.equal(await app.evaluate(({clipboard}) => clipboard.readText()), value);
  }

  await field.selectOption('fullName');
  await copyButton.click();
  await expectClipboard(records.map((r) => r.fullName).join('\n'));
  await page.locator('#classifier-query').fill('Group A Person');
  await page.locator('[data-action="classifier-filter"]').click();
  await page.getByText('Все 7 записей с учётом фильтра, включая другие страницы').waitFor();
  const selected = records.filter((r) => r.fullName.includes('Group A Person'));
  await page.locator('#classifier-sort').selectOption('descending');
  await copyButton.click();
  await expectClipboard(selected.map((r) => r.fullName).reverse().join('\n'));
  await page.locator('#classifier-query').fill('');
  await page.locator('[data-action="classifier-filter"]').click();
  await field.selectOption('backupEmail');
  await copyButton.click();
  await expectClipboard(records.map((r) => r.backupEmail).reverse().join('\n'));
});
