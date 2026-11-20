const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');

test(
  'TZ35: full-column clipboard preserves empty rows across pages, filters and sorting',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz35-align-'));
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

    const records = Array.from({ length: 63 }, (_, i) => ({
      fullName: [0, 25, 51, 62].includes(i)
        ? ''
        : `Group ${i % 10 === 0 ? 'A' : 'B'} Person ${String(i).padStart(3, '0')}`,
      accountId: String(615000000000000 + i),
      email: `test${i}@example.test`,
      backupEmail: [10, 30, 60].includes(i) ? '' : `backup${i}@example.test`,
      geo: 'US'
    }));
    await (await app.firstWindow()).locator('[data-view="import"]').click();
    const page = await app.firstWindow();
    await page.locator('#file-input').setInputFiles({
      name: 'only-synthetic-blanks.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(records))
    });
    await page.locator('[data-classifier-status]').waitFor();

    const columnButton = (key) => page.locator('.classifier-table [data-action="classifier-copy-column"][data-field="' + key + '"]');
    assert.equal(await page.locator('.classifier-bulk-copy').count(), 0);
    assert.equal(await columnButton('fullName').isVisible(), true);

    async function clipboardEquals(expected) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const actual = await app.evaluate(({ clipboard }) => clipboard.readText());
        if (actual === expected) return;
        await page.waitForTimeout(50);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
    }

    await columnButton('fullName').click();
    await clipboardEquals(records.map((row) => row.fullName).join('\n'));

    // No password is populated anywhere: preserve 63 empty record slots.
    await columnButton('emailPassword').click();
    await clipboardEquals('\n'.repeat(records.length - 1));

    await page.locator('#classifier-query').fill('Group A Person');
    await page.locator('[data-action="classifier-filter"]').click();
    const filtered = records.filter((row) => row.fullName.includes('Group A Person'));
    await page.waitForFunction(
      (count) => document.querySelectorAll('.classifier-table tbody tr').length === count,
      filtered.length
    );
    await page.locator('#classifier-sort').selectOption('descending');
    await columnButton('backupEmail').click();
    await clipboardEquals(
      filtered
        .map((row) => row.backupEmail)
        .reverse()
        .join('\n')
    );
  }
);
