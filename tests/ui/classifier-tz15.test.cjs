const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');

test('TZ15 installed classifier displays and copies two distinct passwords, second email and GEO from mixed TXT', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz15-classifier-ui-'));
  const store = await openStore(root);
  store.set('tourSeen', true);
  store.close();

  const app = await _electron.launch({
    executablePath: process.env.BLEGO_EXECUTABLE || undefined,
    args: [
      ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
      ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
      `--user-data-dir=${root}`
    ]
  });
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const page = await app.firstWindow();
  const text = [
    ':: SyntheticFb9 ::', 'one@example.test.', 'SyntheticFb9',
    'second@example.test', 'SyntheticMail!4567', '1.11.1998',
    '61500000123456', 'Desi Sample', 'https://example.test/2fa/',
    'LIMIT 50', 'GEO Spain', 'БМ1'
  ].join(';');
  await page.locator('[data-view="import"]').click();
  await page.locator('#file-input').setInputFiles({
    name: 'synthetic-account.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(text)
  });
  await page.locator('[data-classifier-status]').waitFor();

  const record = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return state.importData?.records[0];
  });
  assert.equal(record.data.password, 'SyntheticFb9');
  assert.equal(record.data.emailPassword, 'SyntheticMail!4567');
  assert.equal(record.data.email, 'one@example.test');
  assert.equal(record.data.backupEmail, 'second@example.test');
  assert.equal(record.data.accountId, '61500000123456');
  assert.equal(record.data.fullName, 'Desi Sample');
  assert.equal(record.data.birthDate, '1.11.1998');
  assert.equal(record.data.geo, 'Spain');
  assert.equal(record.sourceRecord, text);
  assert.equal(await page.locator('#classifier-extra').count(), 0);
  assert.equal(await page.locator('#classifier-options').count(), 1);
  assert.ok(await page.locator('[data-action="classifier-archive"]').isVisible());
  assert.ok(await page.locator('[data-action="classifier-export"]').first().isVisible());

  for (const [field, value] of [
    ['password', 'SyntheticFb9'],
    ['emailPassword', 'SyntheticMail!4567']
  ]) {
    const cell = page.locator(`.classifier-table [data-action="classifier-copy-cell"][data-field="${field}"]`);
    assert.ok(await cell.isEnabled());
    await cell.click();
    for (let n = 0; n < 60; n++) {
      if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === value) break;
      await page.waitForTimeout(20);
    }
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), value);
  }
  await page.locator('[data-action="classifier-details"][data-row="1"]').click();
  await page.locator('#classifier-record-details [data-action="classifier-reveal"][data-field="backupEmail"]').click();
  assert.equal(
    await page.locator('#classifier-record-details [data-detail-value="backupEmail"]').textContent(),
    'second@example.test'
  );
  if (process.env.BLEGO_CAPTURE) {
    fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
    await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz15-classifier-mixed.png') });
  }
});
