const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'classifier UI has eleven compact columns, explicit schema/mapping and stable navigation',
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
      buffer: Buffer.from(
        'id\tcookies\n' +
          Array.from({ length: 51 }, (_, i) => `00${i}\tFAKE_COOKIE_${i}`).join('\n')
      )
    });
    await page.locator('[data-classifier-status]').waitFor();
    assert.deepEqual(await page.locator('.classifier-table th').allTextContents(), [
      '№',
      'ФИО',
      'ID',
      'Пароль',
      'Пароль от почты',
      'Почта',
      'Дата рождения',
      'ГЕО',
      'User-Agent',
      'Токен',
      'Куки'
    ]);
    assert.equal(await page.locator('.classifier-table tbody tr').count(), 50);
    const geometry = await page.locator('[data-row="1"][data-field="accountId"]').evaluate((b) => {
      const text = b.previousElementSibling.getBoundingClientRect(),
        button = b.getBoundingClientRect();
      return {
        textRight: text.right,
        textTop: text.top,
        buttonLeft: button.left,
        buttonTop: button.top
      };
    });
    assert.ok(
      geometry.buttonLeft >= geometry.textRight &&
        Math.abs(geometry.textTop - geometry.buttonTop) < 10,
      'copy icon belongs beside its value'
    );
    await page.locator('[data-action="import-page"][data-offset="50"]').click();
    await page.locator('[data-row="51"][data-field="cookies"]').waitFor();
    assert.equal(await page.locator('.classifier-table tbody tr').count(), 1);
    await page.locator('#classifier-sort').selectOption('descending');
    await page.locator('[data-row="51"][data-field="cookies"]').waitFor();
    assert.equal(
      await page.locator('.classifier-table tbody tr').first().locator('td').first().innerText(),
      '51'
    );
    await page.locator('#classifier-query').fill('0050');
    await page.locator('[data-action="classifier-filter"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll('.classifier-table tbody tr').length === 1
    );
    await page.locator('[data-action="import-reset"]').click();
    await page.locator('#classifier-schema').selectOption('core7');
    await page.locator('#classifier-headers').selectOption('no');
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from('Example Person\t0001\tFAKE_PASS\t\tperson@example.com\t01/02/2000\tGB')
    });
    await page.locator('[data-row="1"][data-field="fullName"]').waitFor();
    assert.ok((await page.locator('.classifier-table').innerText()).includes('Example Person'));
    await page.locator('[data-action="import-reset"]').click();
    await page.locator('#classifier-schema').selectOption('');
    await page.locator('#file-input').setInputFiles({
      name: 'synthetic.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from('FAKE_A\tFAKE_B')
    });
    await page.locator('[data-classifier-status]').waitFor();
    await page.locator('#classifier-options summary').click();
    await page.locator('[data-classifier-map="column_1"]').selectOption('password');
    await page.locator('[data-classifier-map="column_2"]').selectOption('emailPassword');
    await page.locator('[data-action="classifier-apply"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-classifier-status]')?.dataset.classifierStatus ===
        'preview_complete'
    );
    assert.ok(!(await page.locator('.classifier-table').innerText()).includes('FAKE_A'));
    await page
      .locator('.classifier-table [data-action="classifier-copy-cell"][data-field="password"]')
      .click();
    await page.waitForTimeout(100);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'FAKE_A');
    await page.locator('[data-action="import-reset"]').click();
    assert.equal(await page.locator('.classifier-table').count(), 0);
    if (process.env.BLEGO_CAPTURE_UX === '1') {
      await page.locator('#classifier-headers').selectOption('');
      await page.locator('[data-action="import-sample"]').click();
      await page.locator('[data-classifier-status]').waitFor();
      await page.evaluate(() => document.getElementById('toasts')?.replaceChildren());
      fs.mkdirSync('release', { recursive: true });
      await page.screenshot({ path: 'release/ux-classifier.png' });
    }
  }
);
