const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'group UI preserves drafts, explicit reference fields, save and restart',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-group-ui-'));
    const source = await imageFixture(root, 'png');
    let app;
    t.after(async () => {
      if (app) await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    async function launch() {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${path.join(root, 'data')}`
        ]
      });
      const page = await app.firstWindow();
      await page.locator('[data-action="generate"]').first().waitFor();
      await page.evaluate(() => window.blego.markTour()).catch(() => {});
      await page.locator('[data-view="photos"]').click();
      return page;
    }
    let page = await launch();
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, source);
    await page.locator('[data-action="images-choose"]').click();
    await page.locator('#metadata-form').waitFor();
    await page.locator('#image-group-name').fill('Explicit group');
    await page.locator('[data-action="group-create"]').click();
    await page
      .locator('#image-group option')
      .filter({ hasText: 'Explicit group' })
      .waitFor({ state: 'attached' });
    await page.locator('[data-action="group-move"]').click();
    await page.locator('#image-edit-target').selectOption('group');
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('My title');
    await page.locator('#image-edit-target').selectOption('selection');
    await page.locator('#image-edit-target').selectOption('group');
    assert.equal(await page.locator('[name="value-title"]').inputValue(), 'My title');
    await page.locator('[data-action="group-operations"]').click();
    await waitForAsync(page, async () =>
      (await window.blego.imageWorkspace()).groups.some((g) =>
        g.operations.some((op) => op.value === 'My title')
      )
    );
    await page.locator('[data-action="reference-choose"]').click();
    await page.locator('[data-reference-field="title"]').waitFor();
    assert.equal(await page.locator('[data-reference-field]:checked').count(), 0);
    await page.locator('[data-reference-field="title"]').check();
    await page.locator('[data-action="reference-use"]').click();
    await page.waitForFunction(
      () => document.querySelector('[name="value-title"]').value === 'Исходный заголовок'
    );
    await page.locator('[data-action="group-save"]').click();
    await page
      .getByText('Group rules saved locally. File overrides remain session-only.', { exact: true })
      .waitFor();
    await app.close();
    app = null;
    page = await launch();
    assert.equal(
      await page.locator('#image-group option').filter({ hasText: 'Explicit group' }).count(),
      1
    );
    assert.equal(await page.locator('[data-image-select]').count(), 0);
  }
);
