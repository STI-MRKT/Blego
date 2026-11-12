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
    const second = path.join(root, 'second.png');
    fs.copyFileSync(source, second);
    const output = path.join(root, 'copies');
    fs.mkdirSync(output);
    await app.evaluate(
      ({ dialog }, { source, second, output }) => {
        dialog.showOpenDialog = async (_window, options) => ({
          canceled: false,
          filePaths: options.properties.includes('openDirectory')
            ? [output]
            : options.properties.includes('multiSelections')
              ? [source, second]
              : [source]
        });
      },
      { source, second, output }
    );
    await page.locator('[data-action="images-choose"]').click();
    await page.locator('#metadata-form').waitFor();
    await page.locator('details.ux-group-controls summary').click();
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
    await app.evaluate(({ dialog }) => {
      const previous = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = previous;
        return { canceled: true, filePaths: [] };
      };
    });
    await page.locator('[data-action="images-choose"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy;
    });
    assert.equal(
      await page.locator('[name="value-title"]').inputValue(),
      'My title',
      'cancel Add preserves unsaved draft'
    );

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
    await page.evaluate(async () => {
      const ids = Object.keys((await window.blego.imageWorkspace()).membership);
      for (let i = 0; i < ids.length; i++)
        await window.blego.changeImageWorkspace({
          action: 'setFileOverrides',
          fileId: ids[i],
          overrides: [
            { field: 'title', action: 'set', value: 'Individual ' + i, origin: { kind: 'manual' } }
          ]
        });
    });
    await page.locator('#image-edit-target').selectOption('selection');
    await page.locator('#metadata-form [type="submit"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !!state.metadataPlan;
    });
    const titles = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.metadataPlan.files.map(
        (f) => f.operations.find((op) => op.field === 'title').value
      );
    });
    assert.deepEqual(
      titles,
      ['Individual 0', 'Individual 1'],
      'preview without edits preserves distinct overrides'
    );

    await page.locator('[data-metadata-plan]').waitFor();
    await page.locator('[data-action="group-select"]').click();
    assert.equal(
      await page.locator('[data-metadata-plan]').count(),
      0,
      'group selection invalidates executable preview'
    );
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('Shared');
    await page.locator('[data-action="group-operations"]').click();
    await waitForAsync(page, async () =>
      Object.values((await window.blego.imageWorkspace()).overrides).every(
        (ops) => ops.find((op) => op.field === 'title').value === 'Shared'
      )
    );
    await page.locator('[data-image-select]').nth(1).uncheck();
    await page.locator('[name="value-title"]').fill('A revised');
    await page.locator('[data-action="group-operations"]').click();
    await waitForAsync(page, async () =>
      Object.values((await window.blego.imageWorkspace()).overrides).some(
        (ops) => ops.find((op) => op.field === 'title').value === 'A revised'
      )
    );
    await page.locator('details.ux-preset-tools summary').click();
    await page.locator('#metadata-preset-name').fill('Does not create a metadata draft');
    await page.locator('[data-image-select]').nth(1).check();
    await page.locator('#metadata-form [type="submit"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !!state.metadataPlan;
    });
    assert.deepEqual(
      await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return state.metadataPlan.files.map(
          (f) => f.operations.find((op) => op.field === 'title').value
        );
      }),
      ['A revised', 'Shared'],
      'revisited applied multi draft cannot overwrite newer single edit'
    );
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('Latest');
    await page.locator('[data-action="group-operations"]').click();
    await waitForAsync(page, async () =>
      Object.values((await window.blego.imageWorkspace()).overrides).every(
        (ops) => ops.find((op) => op.field === 'title').value === 'Latest'
      )
    );
    await page.locator('[data-image-select]').nth(1).uncheck();
    assert.equal(
      await page.locator('[name="value-title"]').inputValue(),
      'Latest',
      'old single cache cannot undo new multi edit'
    );
    await page.locator('[data-image-select]').nth(1).check();
    await page.locator('[data-action="photo-remove"]').first().click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 1;
    });
    assert.equal(
      await page.locator('[name="value-title"]').inputValue(),
      'Latest',
      'remove restores remaining file draft'
    );
    const groupCopy = await page.evaluate(async () => {
      const { resolveCopySource } = await import('/js/utils/copy-actions.js');
      return resolveCopySource('image-group');
    });
    assert.equal(groupCopy.rows.length, 1, 'group copy uses complete group model after removal');
    assert.equal(groupCopy.rows[0].values.groupName, 'Explicit group');
    await app.close();
    app = null;
    page = await launch();
    assert.equal(
      await page.locator('#image-group option').filter({ hasText: 'Explicit group' }).count(),
      1
    );
    assert.equal(await page.locator('[data-image-select]').count(), 0);
    const saved = await page.evaluate(() => window.blego.imageWorkspace());
    assert.equal(
      saved.groups
        .find((g) => g.name === 'Explicit group')
        .operations.find((op) => op.field === 'title').value,
      'Исходный заголовок',
      'Save includes current displayed reference draft'
    );
  }
);
