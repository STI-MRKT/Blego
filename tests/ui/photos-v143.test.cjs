const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
const { normalizedValue } = require('../../electron/features/images/policy.cjs');
for (const folders of [false, true])
  test(
    `TZ11 Photos saves20 ${folders ? 'folder' : 'individual'} images with automatic fresh plan and no primary technical panels`,
    { timeout: 120000 },
    async (t) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-simple-photos-')),
        input = path.join(root, 'input'),
        out = path.join(root, 'out');
      fs.mkdirSync(input);
      fs.mkdirSync(out);
      const templates = [];
      for (const format of ['jpeg', 'png', 'webp'])
        templates.push(await imageFixture(root, format));
      const files = Array.from({ length: 20 }, (_, i) => {
        const source = templates[i % 3],
          file = path.join(input, `photo-${i}${path.extname(source)}`);
        fs.copyFileSync(source, file);
        return file;
      });
      const originals = files.map((f) => fs.readFileSync(f));
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
      const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
      await page.locator('[data-view="photos"]').click();
      if (folders) {
        await app.evaluate(({ dialog }, input) => {
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [input] });
        }, input);
        await page.locator('[data-action="images-folder"]').click();
      } else await page.locator('#photo-input').setInputFiles(files);
      await waitForAsync(page, async () => {
        const { state } = await import('/js/state.js');
        return !state.imagesBusy && state.photos.length === 20;
      });
      assert.equal(
        await page.locator('[data-action="metadata-export"]').count(),
        1,
        'Save must not depend on manual Preview'
      );
      assert.doesNotMatch(
        await page.locator('#view').innerText(),
        /Preview changes|More metadata and presets|Reports and export history|Groups and reference image|File details|No copies saved|no_changes|Retry selected files/
      );
      await app.evaluate(({ dialog }, out) => {
        globalThis.destinationPrompts = 0;
        dialog.showOpenDialog = async () => {
          globalThis.destinationPrompts++;
          return { canceled: false, filePaths: [out] };
        };
      }, out);
      await page.locator('[data-action="metadata-export"]').click();
      await page.getByText('Нет изменений для сохранения', { exact: true }).waitFor();
      assert.equal(await app.evaluate(() => globalThis.destinationPrompts), 0);
      assert.equal(fs.readdirSync(out).length, 0);
      await page.locator('#geo-country').fill('FR');
      await page.locator('#geo-country').press('Tab');
      await page.locator('#geo-city').selectOption('osm:relation:71525');
      await page.locator('[data-action="geo-generate"]').click();
      await waitForAsync(page, async () => {
        const { state } = await import('/js/state.js');
        return !state.imagesBusy && state.metadataPreview?.files.length === 20;
      });
      await page.locator('[name="action-captureDate"]').selectOption('set');
      await page.locator('[name="date-local"]').fill('2025-02-03T04:05:06');
      await page.locator('[data-action="metadata-export"]').click();
      await waitForAsync(page, async () => {
        const { state } = await import('/js/state.js');
        return !state.imagesBusy && state.metadataExport?.files.length === 20;
      });
      const saved = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return { report: state.metadataExport, workspace: state.imageWorkspace };
      });
      assert.ok(saved.report.files.every((f) => f.status === 'completed'));
      for (const file of saved.report.files) {
        const tags = (await createEngine().read(path.join(out, file.outputName))).tags;
        assert.equal(normalizedValue('captureDate', tags).local, '2025-02-03T04:05:06');
        const gps = normalizedValue('gps', tags),
          expected = saved.workspace.overrides[file.fileId].find((o) => o.field === 'gps').value;
        assert.ok(Math.abs(gps.latitude - expected.latitude) < 1e-6);
        assert.ok(Math.abs(gps.longitude - expected.longitude) < 1e-6);
      }
      files.forEach((file, i) => assert.deepEqual(fs.readFileSync(file), originals[i]));
      assert.equal(await page.locator('[data-action="metadata-retry"]').count(), 0);
      if (process.env.BLEGO_CAPTURE) {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setSize(1280, 900)
        );
        await page.locator('#photo-map-canvas').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(
            process.env.BLEGO_CAPTURE,
            `tz11-photos-${folders ? 'folder' : 'files'}.png`
          )
        });
      }
    }
  );
test(
  'TZ11 cancel during destination selection cannot export or show success; next save is fresh',
  { timeout: 45000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-photo-cancel-')),
      out = path.join(root, 'out');
    fs.mkdirSync(out);
    const file = await imageFixture(root, 'jpeg'),
      original = fs.readFileSync(file);
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
    const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(file);
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.imagesBusy);
    await page.locator('[name="action-captureDate"]').selectOption('set');
    await page.locator('[name="date-local"]').fill('2025-02-03T04:05:06');
    await app.evaluate(({ dialog }) => {
      globalThis.choosingDestination = false;
      dialog.showOpenDialog = async () => {
        globalThis.choosingDestination = true;
        return new Promise((resolve) => {
          globalThis.resolveDestination = resolve;
        });
      };
    });
    await page.locator('[data-action="metadata-export"]').click();
    for (let i = 0; i < 100 && !(await app.evaluate(() => globalThis.choosingDestination)); i++)
      await page.waitForTimeout(50);
    assert.equal(await app.evaluate(() => globalThis.choosingDestination), true);
    assert.equal(await page.locator('[name="date-local"]').isDisabled(), true);
    await page.locator('[data-action="metadata-cancel"]').click();
    await app.evaluate(
      (_electron, out) => globalThis.resolveDestination({ canceled: false, filePaths: [out] }),
      out
    );
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.imagesBusy);
    assert.equal(fs.readdirSync(out).length, 0);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.ok(
      (await page.evaluate(async () => (await import('/js/state.js')).state.metadataExport)) == null
    );
    await app.evaluate(({ dialog }, out) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out] });
    }, out);
    await page.locator('[name="date-local"]').fill('2026-03-04T05:06:07');
    await page.locator('[data-action="metadata-export"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy && state.metadataExport?.files[0].status === 'completed';
    });
    const report = await page.evaluate(
      async () => (await import('/js/state.js')).state.metadataExport
    );
    assert.equal(
      normalizedValue(
        'captureDate',
        (await createEngine().read(path.join(out, report.files[0].outputName))).tags
      ).local,
      '2026-03-04T05:06:07'
    );
  }
);
test(
  'review: Save carries explicit MakerNotes acknowledgment through fresh preparation and actual camera copy',
  { timeout: 45000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-maker-save-')),
      out = path.join(root, 'out');
    fs.mkdirSync(out);
    const file = await imageFixture(root, 'jpeg'),
      original = fs.readFileSync(file);
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
    const page = await require('../fixtures/map-offline.cjs').firstWindowOfflineMap(app);
    await page.locator('[data-view="photos"]').click();
    await page.locator('#photo-input').setInputFiles(file);
    await waitForAsync(page, async () => !(await import('/js/state.js')).state.imagesBusy);
    await page.locator('[data-action="photos-tools"]').click();
    assert.equal(await page.locator('.photo-device-card').count(), 1);
    await page.locator('#photo-device-preset').selectOption('Sony|ILCE-7M4');
    assert.equal(await page.locator('[name="action-make"]').inputValue(), 'set');
    assert.equal(await page.locator('[name="action-model"]').inputValue(), 'set');
    assert.equal(await page.locator('[name="value-make"]').inputValue(), 'Sony');
    assert.equal(await page.locator('[name="value-model"]').inputValue(), 'ILCE-7M4');
    await page.locator('[name="confirm-maker"]').check();
    await app.evaluate(({ ipcMain, dialog }, out) => {
      const channel = 'local:imageGroupPrepare',
        original = ipcMain._invokeHandlers.get(channel);
      globalThis.makerAcknowledgments = [];
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (event, arg) => {
        globalThis.makerAcknowledgments.push(arg.acknowledgeMakerNotes);
        return arg.acknowledgeMakerNotes
          ? original(event, arg)
          : { ok: false, code: 'MAKER_NOTES_CONFIRMATION_REQUIRED' };
      });
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [out] });
    }, out);
    await page.locator('[data-action="metadata-export"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.imagesBusy;
    });
    assert.deepEqual(await app.evaluate(() => globalThis.makerAcknowledgments), [true]);
    const report = await page.evaluate(
      async () => (await import('/js/state.js')).state.metadataExport
    );
    assert.equal(report.files[0].status, 'completed');
    assert.deepEqual(fs.readFileSync(file), original);
    const tags = (await createEngine().read(path.join(out, report.files[0].outputName))).tags;
    assert.equal(normalizedValue('make', tags), 'Sony');
    assert.equal(normalizedValue('model', tags), 'ILCE-7M4');
    assert.equal(await page.locator('.photo-workspace.has-selection').count(), 1);
  }
);
