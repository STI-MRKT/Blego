const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'native folder chooser shows nested source paths and exports the same relative structure',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-folders-ui-')),
      input = path.join(root, 'album'),
      nested = path.join(input, 'portraits'),
      out = path.join(root, 'out');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(out);
    for (const format of ['jpeg', 'png', 'webp']) await imageFixture(nested, format);
    fs.writeFileSync(path.join(input, 'ignored.txt'), 'synthetic unsupported file');
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
    assert.equal(
      await page.getByRole('button', { name: 'Добавить папку', exact: true }).count(),
      1
    );
    await app.evaluate(({ dialog }, input) => {
      dialog.showOpenDialog = async (_window, options) => {
        if (!options.properties.includes('openDirectory'))
          throw Error('expected native directory chooser');
        return { canceled: false, filePaths: [input] };
      };
    }, input);
    await page.getByRole('button', { name: 'Добавить папку', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.imagesBusy &&
        state.photos.length === 3 &&
        state.photos.every((p) => p.status === 'ready')
      );
    });
    assert.equal(await page.locator('.photo-source').count(), 3);
    assert.match(await page.locator('.photo-source').first().innerText(), /portraits/);
    assert.match(await page.locator('#image-scan-status').innerText(), /3/);
    await page.locator('#geo-country').fill('FR');
    await page.locator('#geo-country').press('Tab');
    await page.locator('#geo-city').selectOption('osm:relation:71525');
    await page.locator('[data-action="geo-generate"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.geoBusy && Object.keys(state.imageWorkspace.overrides).length === 3;
    });
    await app.evaluate(({ dialog }, out) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out] });
    }, out);
    await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
    await page.locator('[data-metadata-plan]').waitFor();
    await page.getByRole('button', { name: 'Save copies', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.imagesBusy && state.metadataExport?.files.every((f) => f.status === 'completed')
      );
    });
    const result = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.metadataExport;
    });
    for (const file of result.files) {
      assert.match(file.outputName, /\/portraits\//);
      assert.ok(fs.existsSync(path.join(out, file.outputName)));
    }
  }
);
