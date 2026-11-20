const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');

function launchArgs(data) {
  return [
    ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
    ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
    '--user-data-dir=' + data
  ];
}
async function clipboardMatches(app, page, expected) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const text = await app.evaluate(({ clipboard }) => clipboard.readText());
    if (text === expected) return;
    await page.waitForTimeout(50);
  }
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
}

test('TZ37 classifier has only search/export/actions, archives Cookies by default and copies by whole archive tile', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz37-import-'));
  const data = path.join(root, 'data');
  const store = await openStore(data);
  store.set('tourSeen', true);
  store.close();
  const app = await _electron.launch({ executablePath: process.env.BLEGO_EXECUTABLE || undefined, args: launchArgs(data) });
  t.after(async () => { await app.close(); fs.rmSync(root, { recursive: true, force: true }); });

  const cookie = JSON.stringify([
    { domain: '.facebook.com', name: 'c_user', value: '61500000001234' },
    { domain: '.facebook.com', name: 'xs', value: 'SYNTHETIC_NOT_A_SESSION' }
  ]);
  const record = {
    fullName: 'Synthetic Person', accountId: '61500000001234', email: 'synthetic@example.test',
    password: 'FAKE_TEST_ONLY', cookies: cookie
  };
  const page = await app.firstWindow();
  await page.locator('[data-view="import"]').click();
  await page.locator('#file-input').setInputFiles({
    name: 'synthetic-cookie.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([record]))
  });
  await page.locator('[data-classifier-status]').waitFor();
  for (const selector of [
    '#classifier-options', '#classifier-sort', '#classifier-warnings-only',
    '#archive-include-cookies', '[data-action="import-copy"]'
  ]) assert.equal(await page.locator(selector).count(), 0, selector);
  assert.equal(await page.locator('[data-action="classifier-export"][data-format="csv"]').count(), 1);
  assert.equal(await page.locator('.classifier-table [data-action="classifier-copy-column"][data-field="cookies"]').count(), 1);

  await page.locator('[data-action="classifier-archive"]').click();
  await page.locator('[data-view="history"]').click();
  await page.locator('.hrow .nm').filter({ hasText: 'synthetic-cookie.json' }).click();
  const card = page.locator('.archive-cookie-field').first();
  await card.waitFor();
  assert.equal(await card.isEnabled(), true);
  assert.equal(await card.innerText(), 'COOKIE');
  assert.equal(await card.locator('button').count(), 0);
  const box = await card.boundingBox();
  assert.ok(box && box.height >= 52, 'whole cookie tile is the click target');
  await card.click();
  await clipboardMatches(app, page, cookie);
});

test('TZ37 Photos hide exact GPS and altitude editors; GEO city/catalog open with one click', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz37-geo-'));
  const img = await imageFixture(root, 'jpeg');
  const data = path.join(root, 'data');
  const store = await openStore(data);
  store.set('tourSeen', true);
  store.close();
  const app = await _electron.launch({ executablePath: process.env.BLEGO_EXECUTABLE || undefined, args: launchArgs(data) });
  t.after(async () => { await app.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
  await page.locator('[data-view="photos"]').click();
  await page.locator('#photo-input').setInputFiles(img);
  await waitForAsync(page, async () => {
    const { state } = await import('/js/state.js');
    return state.photos.length === 1 && !state.imagesBusy;
  });
  assert.equal(await page.locator('#gps-manual').count(), 0);
  assert.equal(await page.locator('[name="gps-altitude"]').count(), 0);
  assert.equal(await page.getByText('Exact coordinates and altitude').count(), 0);
  const catalog = page.locator('.geo-city-catalog');
  await catalog.locator('summary').click();
  assert.equal(await catalog.getAttribute('open'), '');
  assert.ok((await catalog.innerText()).includes('Import'));
  assert.ok(!(await catalog.innerText()).includes('City of London'));
  const city = page.locator('#geo-city');
  await city.evaluate((el) => {
    el.showPicker = () => { el.dataset.firstClick = 'yes'; };
  });
  await city.click();
  assert.equal(await city.getAttribute('data-first-click'), 'yes');
  const padding = await city.evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingLeft));
  assert.ok(padding >= 12);
});
