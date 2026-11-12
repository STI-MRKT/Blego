const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'cookie cell copies exact original at 12/1000/10000 chars across sort, filter and pages; mass copy excludes secrets',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-classifier-copy-'));
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
    const cookies = [12, 1000, 10000].map((n) => 'FAKE_COOKIE_' + 'x'.repeat(n - 12));
    const rows = Array.from({ length: 51 }, (_, i) => ({
      fullName: 'Example ' + i,
      accountId: '00' + i,
      password: 'FAKE_LOGIN',
      emailPassword: 'FAKE_MAIL',
      email: 'person' + i + '@example.com',
      birthDate: '01.01.2000',
      geo: 'GB',
      userAgent: 'Mozilla/5.0 FAKE_UA',
      token: 'FAKE_TOKEN_' + i,
      cookies: i === 0 ? cookies[0] : i === 1 ? cookies[1] : i === 50 ? cookies[2] : ''
    }));
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(rows))
    });
    await page.locator('[data-classifier-status]').waitFor();
    async function clip(expected) {
      for (let i = 0; i < 100; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === expected) return;
        await page.waitForTimeout(20);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
    }
    async function copyRow(id, expected) {
      const b = page.locator(`[data-row="${id}"][data-field="cookies"]`);
      const shown = await b.evaluate((e) => e.previousElementSibling.textContent);
      assert.ok(shown.length <= 13);
      assert.equal(
        await b.evaluate((e) => e.closest('td').outerHTML.includes('x'.repeat(100))),
        false
      );
      await b.click();
      await clip(expected);
      assert.equal(await page.locator('[data-copy-control="format"]').count(), 0);
    }
    await copyRow('1', cookies[0]);
    await copyRow('2', cookies[1]);
    assert.equal(await page.locator('[data-row="3"][data-field="cookies"]').isDisabled(), true);
    await page.locator('[data-action="import-page"][data-offset="50"]').click();
    await page.locator('[data-row="51"][data-field="cookies"]').waitFor();
    await copyRow('51', cookies[2]);
    await page.locator('#classifier-sort').selectOption('descending');
    await page.locator('[data-row="50"][data-field="cookies"]').waitFor();
    await copyRow('51', cookies[2]);
    await page.locator('#classifier-query').fill('0050');
    await page.locator('[data-action="classifier-filter"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('.classifier-table tbody tr').length === 1
    );
    await copyRow('51', cookies[2]);
    await page.locator('[data-action="classifier-copy-row"][data-row="51"]').click();
    let text = '';
    for (let i = 0; i < 100; i++) {
      text = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (text.includes('FAKE_MAIL')) break;
      await page.waitForTimeout(20);
    }
    assert.ok(text.includes('FAKE_LOGIN') && text.includes('FAKE_MAIL'));
    assert.ok(!/FAKE_COOKIE|FAKE_TOKEN|FAKE_UA/.test(text));
    assert.equal(text.split('\n')[0].split('\t').length, 7);
    await page.locator('[data-action="classifier-copy-table"]').click();
    for (let i = 0; i < 100; i++) {
      text = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (text.split('\n').length === 52) break;
      await page.waitForTimeout(20);
    }
    assert.equal(text.split('\n').length, 52);
    assert.ok(!/FAKE_COOKIE|FAKE_TOKEN|FAKE_UA/.test(text));
    await page
      .locator('details')
      .filter({ has: page.locator('[data-action="classifier-export"]').first() })
      .locator('summary')
      .first()
      .click();
    const destination = path.join(root, 'result.csv');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, destination);
    await page.locator('[data-action="classifier-export"][data-format="csv"]').click();
    for (let i = 0; i < 100 && !fs.existsSync(destination); i++) await page.waitForTimeout(20);
    const exported = fs.readFileSync(destination, 'utf8');
    assert.equal(exported.split('\n').length, 52);
    assert.ok(!/FAKE_COOKIE|FAKE_TOKEN|FAKE_UA/.test(exported));
    await page.locator('[data-action="classifier-archive"]').click();
    await page.getByText('Сохранено в архиве', { exact: true }).waitFor();
    const archives = await page.evaluate(() => window.blego.listArchives({}));
    assert.equal(archives.items.length, 1);
    const saved = await page.evaluate(
      (id) => window.blego.openArchive(id),
      archives.items[0].archiveId
    );
    assert.ok(!/FAKE_COOKIE|FAKE_TOKEN|FAKE_UA/.test(saved.resultText));
    await page.locator('[data-action="import-reset"]').click();
    assert.equal(await page.locator('.classifier-table').count(), 0);
  }
);
