const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');
test(
  'Photos thumbnails, explicit date/GPS, preview and actual saved copies preserve original files',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-photo-quick-'));
    const data = path.join(root, 'data'),
      out = path.join(root, 'out');
    fs.mkdirSync(data);
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(data, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
    const files = [];
    for (const format of ['jpeg', 'png', 'webp']) files.push(await imageFixture(root, format));
    const originals = files.map((f) => fs.readFileSync(f));
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${data}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    const capture = async (name) => {
      if (process.env.BLEGO_CAPTURE) {
        fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
        await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, name + '.png') });
      }
    };
    await page.locator('[data-view="photos"]').click();
    await app.evaluate(
      ({ dialog }, { files, out }) => {
        dialog.showOpenDialog = async (_window, options) => ({
          canceled: false,
          filePaths: options.properties.includes('openDirectory') ? [out] : files
        });
      },
      { files, out }
    );
    await page.locator('[data-action="images-choose"]').first().click();
    await page.locator('#metadata-form').waitFor();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy;
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.photo-grid img')].every(
        (e) => e.complete && e.naturalWidth > 0
      )
    );
    assert.equal(await page.locator('.photo-grid img').count(), 3);
    for (const img of await page.locator('.photo-grid img').all())
      assert.ok(await img.evaluate((e) => e.complete && e.naturalWidth > 0));
    await capture('photos-primary');
    assert.equal(await page.locator('[name="action-title"]').isVisible(), false);
    assert.equal(await page.locator('[name="date-local"]').inputValue(), '');
    assert.equal(await page.locator('[name="gps-latitude"]').inputValue(), '');
    assert.equal(await page.locator('[name="date-offset-mode"]').inputValue(), 'keep');
    await page.locator('[name="action-captureDate"]').selectOption('set');
    await page.locator('[name="date-local"]').fill('2024-02-29T12:34:56');
    await page.locator('[name="action-gps"]').selectOption('set');
    await page.locator('#gps-manual summary').click();
    await page.locator('[name="gps-latitude"]').fill('0');
    await page.locator('[name="gps-longitude"]').fill('0');
    await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
    await page.locator('[data-metadata-plan]').waitFor();
    await capture('photos-preview');
    assert.equal(fs.readdirSync(out).length, 0);
    await page.getByRole('button', { name: 'Save copies', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return (
        !state.imagesBusy && state.metadataExport?.files.every((f) => f.status === 'completed')
      );
    });
    await capture('photos-export');
    const names = fs.readdirSync(out).filter((n) => !n.startsWith('.'));
    assert.equal(names.length, 3);
    for (const name of names) {
      const tags = (await createEngine().read(path.join(out, name))).tags;
      assert.equal(normalizedValue('captureDate', tags).local, '2024-02-29T12:34:56');
      assert.deepEqual(normalizedValue('gps', tags), { latitude: 0, longitude: 0, altitude: null });
      assert.equal(normalizedValue('author', tags), 'Example Author');
    }
    files.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), originals[i]));
    const firstRun = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.metadataExport.runId;
    });
    await page.getByRole('button', { name: 'Preview changes', exact: true }).click();
    await page.getByRole('button', { name: 'Save copies', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel export', exact: true }).click();
    await waitForAsync(
      page,
      async (firstRun) => {
        const { state } = await import('/js/state.js');
        return !state.imagesBusy && state.metadataExport?.runId !== firstRun;
      },
      firstRun
    );
    const cancelled = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.metadataExport;
    });
    assert.ok(
      cancelled.files.some((f) => f.status === 'cancelled'),
      JSON.stringify(cancelled)
    );
    assert.equal(
      fs.readdirSync(out).filter((n) => !n.startsWith('.')).length,
      3 + cancelled.files.filter((f) => f.status === 'completed').length
    );
    files.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), originals[i]));
  }
);
