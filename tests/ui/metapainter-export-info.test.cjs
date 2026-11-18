const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');

test(
  'MetaPainter manual camera model updates and finished copies are clearly identified',
  { timeout: 120000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-meta-finder-'));
    const out = path.join(root, 'output');
    fs.mkdirSync(out);
    const file = await imageFixture(root, 'jpeg');
    const before = fs.readFileSync(file);
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        '--user-data-dir=' + path.join(root, 'user')
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(file);
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.imagesBusy);
    const make = page.locator('[name="value-make"]');
    const model = page.locator('[name="value-model"]');
    await make.fill('Canon');
    await model.fill('EOS R5');
    // Users should not have to discover a separate Keep/Set selector.
    assert.equal(await page.locator('[name="action-make"]').inputValue(), 'set');
    assert.equal(await page.locator('[name="action-model"]').inputValue(), 'set');
    await page.locator('[name="action-captureDate"]').selectOption('set');
    await page.locator('[name="date-local"]').fill('2012-03-04T05:06:07');
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
    }, out);
    await page.locator('[data-action="metadata-export"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.metadataExport?.files.length === 1;
    });
    const report = await page.evaluate(
      async () => (await import('/js/state.js')).state.metadataExport
    );
    assert.equal(report.files[0].status, 'completed');
    const exported = path.join(out, report.files[0].outputName);
    assert.ok(fs.existsSync(exported));
    assert.ok(report.files[0].outputName.includes('_meta_'));
    assert.deepEqual(fs.readFileSync(file), before);
    const tags = (await createEngine().read(exported)).tags;
    assert.equal(normalizedValue('make', tags), 'Canon');
    assert.equal(normalizedValue('model', tags), 'EOS R5');
    assert.equal(normalizedValue('captureDate', tags).local, '2012-03-04T05:06:07');
    // This is the file to inspect in Finder, NOT the unchanged original.
    const summary = await page.locator('[data-exported-copy]').first().innerText();
    assert.ok(summary.includes(report.files[0].outputName));
    assert.ok(
      (await page.locator('#view').innerText()).includes('Исходные фотографии не изменены')
    );
  }
);
