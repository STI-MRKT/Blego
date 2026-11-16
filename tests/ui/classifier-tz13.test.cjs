const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { fields, pairs, block } = require('../fixtures/classifier-tz13.cjs');

test(
  'TZ13 actual clipboard, manual assignment, export and archive preserve synthetic fields across four formats',
  { timeout: 120000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz13-ui-'));
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
    const { parseText } = await import('../../shared/importer.mjs');
    const expected = [
      '',
      "'" + fields.accountId,
      fields.password,
      fields.emailPassword,
      fields.email,
      fields.birthDate,
      ''
    ];
    const clip = async (value) => {
      for (let i = 0; i < 100; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === value) return;
        await page.waitForTimeout(20);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), value);
    };
    await page.locator('[data-view="import"]').click();
    for (const format of ['txt', 'csv', 'tsv', 'json']) {
      const delimiter = format === 'csv' ? ',' : '\t';
      const quote = (value) =>
        /[",\t\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
      const text =
        format === 'txt'
          ? block
          : format === 'json'
            ? JSON.stringify([Object.fromEntries(pairs)])
            : pairs.map(([label]) => quote(label)).join(delimiter) +
              '\n' +
              pairs.map(([, value]) => quote(value)).join(delimiter);
      await page.locator('#file-input').setInputFiles({
        name: `synthetic.${format}`,
        mimeType: 'text/plain',
        buffer: Buffer.from(text)
      });
      await page.locator('[data-classifier-status]').waitFor();
      assert.equal(await page.locator('.classifier-table tbody tr').count(), 1);
      for (const field of [
        'password',
        'emailPassword',
        'email',
        'accountId',
        'birthDate',
        'token',
        'userAgent',
        'cookies'
      ]) {
        await page
          .locator(
            `.classifier-table [data-action="${field === 'cookies' ? 'import-cookie-copy' : 'classifier-copy-cell'}"][data-row="1"][data-field="${field}"]`
          )
          .click();
        await clip(fields[field]);
      }
      await page.locator('[data-action="classifier-details"][data-row="1"]').click();
      await page
        .locator(
          '#classifier-record-details [data-field="login"][data-action="classifier-copy-cell"]'
        )
        .click();
      await clip(fields.login);
      await page.locator('[data-action="classifier-close-details"]').click();
      await page.locator('[data-action="classifier-copy-row"][data-row="1"]').click();
      let row;
      for (let i = 0; i < 100; i++) {
        row = await app.evaluate(({ clipboard }) => clipboard.readText());
        if (row.includes('\t')) break;
        await page.waitForTimeout(20);
      }
      assert.deepEqual(parseText(row, 'tsv').records[0].raw, expected);
      await page.locator('[data-action="classifier-copy-table"]').click();
      await clip(row);
      await page.locator('#classifier-extra > summary').click();
      await page.locator('[data-action="import-copy"]').click();
      await clip(text);
      const destination = path.join(root, `export-${format}.csv`);
      await app.evaluate(({ dialog }, destination) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
      }, destination);
      await page.locator('[data-action="classifier-export"][data-format="csv"]').click();
      for (let i = 0; i < 100 && !fs.existsSync(destination); i++) await page.waitForTimeout(20);
      assert.deepEqual(
        parseText(fs.readFileSync(destination, 'utf8'), 'csv').records[0].raw,
        expected
      );
      if (format === 'txt') {
        await page.locator('#classifier-options > summary').click();
        await page.locator('[data-classifier-map="Email"]').selectOption('emailPassword');
        await page.locator('[data-action="classifier-apply"]').click();
        await waitForAsync(page, async () => {
          const { state } = await import('./js/state.js');
          return state.importData?.records[0]?.data.emailPassword === 'synthetic-fr@example.test';
        });
        const copy = page.locator('.classifier-table [data-field="emailPassword"]');
        await copy.click();
        await clip(fields.email);
        assert.equal(
          await page.locator('.classifier-table [data-field="email"]').isDisabled(),
          true
        );
        await page.locator('#classifier-options > summary').click();
        await page.locator('[data-classifier-map="Email"]').selectOption('');
        await page.locator('[data-action="classifier-apply"]').click();
        await waitForAsync(page, async () => {
          const { state } = await import('./js/state.js');
          return state.importData?.records[0]?.data.emailPassword === '"SYNTHETIC mail password"  ';
        });
      }
      if (process.env.BLEGO_CAPTURE) {
        fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.waitForFunction(() => !document.querySelector('.toast'));
        await page.screenshot({
          path: path.join(process.env.BLEGO_CAPTURE, `tz13-classifier-${format}.png`),
          animations: 'disabled'
        });
      }
      await page.locator('[data-action="classifier-archive"]').click();
      await page.getByText('Сохранено в архиве', { exact: true }).waitFor();
      const saved = await page.evaluate(async () => {
        const { items } = await window.blego.listArchives({});
        return window.blego.openArchive(items[0].archiveId);
      });
      assert.deepEqual(parseText(saved.resultText, 'tsv').records[0].raw, expected);
      assert.ok(!saved.resultText.includes(fields.token));
      await page.locator('[data-action="import-reset"]').click();
    }
  }
);
