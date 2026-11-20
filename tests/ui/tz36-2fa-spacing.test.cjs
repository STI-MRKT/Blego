const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');

test('TZ36: visible header copy icons, roomy table, masked 2FA and blank-preserving bulk copy', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz36-ui-'));
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
  const key1 = 'ABCD EFGH IJKL MNOP QRST UVWX YZAB CDEF';
  const key3 = 'QRST UVWX YZAB CDEF ABCD EFGH IJKL MNOP';
  const records = [
    { fullName: 'Example One', email: 'example1@example.test', twoFactorCode: key1 },
    { fullName: 'Example Two', email: 'example2@example.test' },
    { fullName: 'Example Three', email: 'example3@example.test', twoFactorCode: key3 }
  ];
  await page.locator('[data-view="import"]').click();
  await page.locator('#file-input').setInputFiles({
    name: 'synthetic-two-factor.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(records))
  });
  await page.locator('[data-classifier-status]').waitFor();
  assert.equal(await page.locator('.classifier-bulk-copy').count(), 0);
  const header = page.locator('.classifier-table thead [data-action="classifier-copy-column"][data-field="twoFactorCode"]');
  assert.equal(await header.isVisible(), true);
  assert.equal(await header.evaluate((el) => getComputedStyle(el).opacity), '1');
  const padding = await page.locator('.classifier-table th').first().evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingLeft));
  assert.ok(padding >= 14, 'classifier columns should have larger side padding');

  const rows = page.locator('.classifier-table tbody tr');
  assert.equal(await rows.count(), 3);
  const first = rows.nth(0);
  const second = rows.nth(1);
  assert.equal(await first.locator('.classifier-2fa-cell .classifier-value').innerText(), '••••••••');
  assert.equal(await second.locator('.classifier-2fa-cell .classifier-value').innerText(), '');
  await first.locator('[data-action="classifier-2fa-reveal"]').click();
  assert.equal(await rows.nth(0).locator('.classifier-2fa-cell .classifier-value').innerText(), key1);
  await rows.nth(0).locator('[data-action="classifier-2fa-reveal"]').click();
  assert.equal(await rows.nth(0).locator('.classifier-2fa-cell .classifier-value').innerText(), '••••••••');

  async function waitClipboard(expected) {
    for (let i = 0; i < 120; i++) {
      const actual = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (actual === expected) return;
      await page.waitForTimeout(50);
    }
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
  }
  await header.click();
  await waitClipboard([key1, '', key3].join('\n'));
});
