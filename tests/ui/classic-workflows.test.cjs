const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');

test('classic BLEGO: original visual controls with streamlined news, proxy, photos and archive', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-classic-ui-'));
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
  await page.locator('[data-action="generate"]').first().waitFor();
  await page.evaluate(() => window.blego.markTour()).catch(() => {});
  await page.locator('[data-action="generate"]').first().click();
  await page.locator('.demo-card').waitFor();
  assert.equal(await page.locator('.sk-card').count(), 0);
  assert.equal(await page.locator('.avatar.xl').isVisible(), true);
  assert.equal(await page.locator('[data-action="copy-model"][data-card="true"]').first().isVisible(), true);
  assert.equal(await page.locator('#news-topic option').count(), 5);
  assert.equal(await page.locator('.news-card').isVisible(), true);
  if (process.env.BLEGO_CAPTURE_UX === '1') {
    fs.mkdirSync('release', { recursive: true });
    await page.screenshot({ path: 'release/classic-generator.png' });
  }
  assert.equal(await page.locator('.side-bottom [data-view="history"]').isVisible(), true);
  await page.locator('[data-view="network"]').click();
  assert.equal(await page.locator('.gauge').isVisible(), true);
  assert.equal(await page.locator('.packets').isVisible(), true);
  assert.equal(await page.locator('[data-action="net-ping"]').isVisible(), true);
  assert.equal(await page.locator('#proxy-input').getAttribute('type'), 'text');
  if (process.env.BLEGO_CAPTURE_UX === '1')
    await page.screenshot({ path: 'release/classic-network.png' });

  await page.locator('[data-view="checker"]').click();
  assert.equal(await page.locator('[data-action="checker-run"]').isVisible(), true);
  assert.equal(await page.locator('[data-action="checker-clear"]').isVisible(), true);
  assert.equal(await page.locator('.checker-card').isVisible(), true);

  const file = await imageFixture(root, 'png');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, file);
  await page.locator('[data-view="photos"]').click();
  await page.locator('[data-action="images-choose"]').click();
  await page.locator('#metadata-form').waitFor();
  assert.equal(await page.locator('[name="date-local"]').isVisible(), true);
  assert.equal(await page.locator('[name="gps-latitude"]').isVisible(), true);
  assert.equal(await page.locator('#image-group-panel').getAttribute('open'), null);
  if (process.env.BLEGO_CAPTURE_UX === '1')
    await page.screenshot({ path: 'release/classic-photos.png' });
});
