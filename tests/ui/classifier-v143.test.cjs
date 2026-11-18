const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { cases } = require('../fixtures/classifier-v143.cjs');
test(
  'TZ11 colon fields and private 2FA copy exactly; archive remains core7',
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
      buffer: Buffer.from(cases.find((c) => c.name === 'labelled :').text)
    });
    await page.locator('[data-classifier-status]').waitFor();
    const copy = page.locator(
      '.classifier-table [data-action="classifier-copy-cell"][data-row="1"][data-field="emailPassword"]'
    );
    assert.match(await copy.locator('..').innerText(), /FAKE_MAIL/);
    await copy.click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'FAKE_MAIL');
    await page.locator('[data-action="classifier-details"][data-row="1"]').click();
    await page
      .locator(
        '#classifier-record-details [data-action="classifier-copy-cell"][data-field="twoFactorCode"]'
      )
      .click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'SYNTHETIC_2FA');
    await page.locator('[data-action="classifier-close-details"]').click();
    assert.equal(await page.locator('#classifier-extra').count(), 0);
    assert.ok(await page.locator('[data-action="classifier-archive"]').isVisible());
    await page.locator('[data-action="classifier-archive"]').click();
    await page.getByText('Сохранено в архиве', { exact: true }).waitFor();
    const saved = await page.evaluate(async () => {
      const { items } = await window.blego.listArchives({});
      return window.blego.openArchive(items[0].archiveId);
    });
    assert.ok(saved.resultText.includes('FAKE_MAIL'));
    assert.ok(!JSON.stringify(saved).includes('SYNTHETIC_2FA'));
    assert.equal(saved.resultText.split('\n')[0].split('\t').length, 7);
    assert.equal(await page.locator('.page-head [data-copy-action="open"]').count(), 0);
    if (process.env.BLEGO_CAPTURE)
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz11-classifier.png') });
  }
);
