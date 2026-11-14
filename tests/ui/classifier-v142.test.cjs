const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { cases } = require('../fixtures/classifier-v142.cjs');
test(
  'TZ9 learned mail password displays, copies and archives without changing absent values',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-mail-ui-'));
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
      buffer: Buffer.from(cases.find((c) => c.name.startsWith('same width')).text)
    });
    await page.locator('[data-classifier-status]').waitFor();
    const copy = page.locator(
      '.classifier-table [data-action="classifier-copy-cell"][data-row="3"][data-field="emailPassword"]'
    );
    assert.match(await copy.locator('..').innerText(), /C_MAIL/);
    await copy.click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'C_MAIL');
    assert.ok(
      await page
        .locator(
          '.classifier-table [data-action="classifier-copy-cell"][data-row="7"][data-field="emailPassword"]'
        )
        .isDisabled()
    );
    await page
      .locator('details')
      .filter({ has: page.locator('[data-action="classifier-archive"]') })
      .locator('summary')
      .first()
      .click();
    await page.locator('[data-action="classifier-archive"]').click();
    await page.getByText('Сохранено в архиве', { exact: true }).waitFor();
    const saved = await page.evaluate(async () => {
      const { items } = await window.blego.listArchives({});
      return window.blego.openArchive(items[0].archiveId);
    });
    assert.ok(saved.resultText.includes('C_MAIL'));
    assert.equal(saved.resultText.split('\n')[0].split('\t').length, 7);
    assert.equal(await page.locator('.page-head [data-copy-action="open"]').count(), 0);
    if (process.env.BLEGO_CAPTURE)
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz9-classifier.png') });
  }
);
