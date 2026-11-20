const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');

test('TZ38 macOS regression: choosing GEO country never crashes or blanks Electron renderer', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz38-country-'));
  const jpeg = await imageFixture(root, 'jpeg');
  const app = await _electron.launch({
    executablePath: process.env.BLEGO_EXECUTABLE || undefined,
    args: [
      ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
      ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
      '--user-data-dir=' + path.join(root, 'data')
    ]
  });
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
  const pageErrors = [];
  const crashes = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('crash', () => crashes.push('renderer crashed'));
  await page.locator('[data-view="photos"]').click();
  await page.locator('#photo-input').setInputFiles(jpeg);
  await waitForAsync(page, async () => {
    const { state } = await import('/js/state.js');
    return state.photos.length === 1 && !state.imagesBusy;
  });

  const country = page.locator('#geo-country');
  assert.equal(await country.evaluate((el) => el.tagName), 'SELECT');
  assert.equal(await page.locator('#geo-countries').count(), 0);
  const nativeOpen = await country.evaluate((el) => typeof el.showPicker === 'function');
  assert.equal(typeof nativeOpen, 'boolean');

  // Real pointer entry followed by native option selection on the same control.
  await country.click();
  await country.selectOption('FR');
  await page.waitForFunction(async () => (await import('/js/state.js')).state.geoCountry === 'FR');
  assert.equal(await page.locator('.page').count() > 0, true, 'Photos remains rendered');
  assert.equal(await page.locator('#geo-country').inputValue(), 'FR');
  await page.locator('#geo-city').selectOption('osm:relation:71525');
  await page.waitForFunction(async () => (await import('/js/state.js')).state.geoCity === 'osm:relation:71525');

  // Switching the country clears the city without an invalid picker re-entry.
  await page.locator('#geo-country').selectOption('DE');
  await page.waitForFunction(async () => (await import('/js/state.js')).state.geoCountry === 'DE');
  assert.equal(await page.locator('#geo-city').inputValue(), '');
  await page.locator('#geo-country').selectOption('FR');
  assert.equal(await page.locator('#geo-country').inputValue(), 'FR');
  assert.equal(await page.locator('#photo-input').count(), 1);
  assert.equal(await page.locator('#photo-map-canvas').count(), 1);

  // The entire navigation shell must remain interactive after the selection.
  await page.locator('[data-view="history"]').click();
  await page.locator('[data-view="photos"]').click();
  assert.equal(await page.locator('#geo-country').inputValue(), 'FR');
  assert.deepEqual(crashes, []);
  assert.deepEqual(pageErrors, []);
});
