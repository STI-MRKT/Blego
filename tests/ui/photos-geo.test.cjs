const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'Photos local city selection, drop, per-file regeneration and stable preview use existing workspace',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-photo-geo-ui-')),
      out = path.join(root, 'out');
    fs.mkdirSync(out);
    const files = [];
    for (const format of ['jpeg', 'png', 'webp']) files.push(await imageFixture(root, format));
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
    await page.locator('[data-view="photos"]').click();
    assert.equal(await page.locator('#photo-input').count(), 1);
    await page.locator('#photo-input').setInputFiles(files);
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 3 && !state.imagesBusy;
    });
    await page.locator('#geo-country').fill('FR');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city-query').fill('Paris');
    await page.locator('#geo-city').selectOption('osm:relation:71525');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.geoBusy &&
        Object.values(state.imageWorkspace.overrides).filter((a) =>
          a.some((o) => o.origin?.kind === 'geo')
        ).length === 3
      );
    });
    const coords = () =>
      page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return Object.fromEntries(
          Object.entries(state.imageWorkspace.overrides).map(([id, ops]) => [
            id,
            ops.find((o) => o.field === 'gps').value
          ])
        );
      });
    const before = await coords();
    const ids = Object.keys(before);
    assert.equal(new Set(Object.values(before).map((x) => JSON.stringify(x))).size, 3);
    await page.locator(`[data-action="geo-regenerate-one"][data-id="${ids[0]}"]`).click();
    await waitForAsync(
      page,
      async (old) => {
        const { state } = await import('/js/state.js');
        return (
          !state.geoBusy &&
          JSON.stringify(
            state.imageWorkspace.overrides[old.id].find((o) => o.field === 'gps').value
          ) !== old.value
        );
      },
      { id: ids[0], value: JSON.stringify(before[ids[0]]) }
    );
    const changed = await coords();
    assert.deepEqual(changed[ids[1]], before[ids[1]]);
    await app.evaluate(({ dialog }, out) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out] });
    }, out);
    await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
    await page.locator('[data-metadata-plan]').waitFor();
    assert.deepEqual(await coords(), changed);
    await page.getByRole('button', { name: 'Save copies', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.imagesBusy && state.metadataExport?.files.every((f) => f.status === 'completed')
      );
    });
    assert.equal(fs.readdirSync(out).length, 3);
    await page.locator('[data-action="photos-clear"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.photo-grid img').length === 0);
    // A native File from the hidden chooser is transferred through an actual DOM drop event.
    await page.locator('#photo-input').evaluate((el) => {
      el.onchange = null;
    });
    await page.locator('#photo-input').setInputFiles(files[0]);
    await page.locator('#photo-input').evaluate((el) => {
      const dt = new DataTransfer();
      for (const f of el.files) dt.items.add(f);
      document
        .getElementById('photo-drop')
        .dispatchEvent(
          new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
        );
    });
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 1 && !state.imagesBusy;
    });
  }
);
