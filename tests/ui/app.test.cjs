const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
test(
  'Electron offline workflow, native clipboard, pending import, ZIP and restart',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-ui-'));
    const data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    const classifier = createClassificationService({ allowTestRules: true });
    const { parseInput } = await import('../../shared/importer.mjs');
    const parsed = await parseInput({
      bytes: Buffer.from('Тестовый результат'),
      originalName: 'TEST-ONLY.txt'
    });
    const preview = classifier.classifyDocument(parsed, {
      testOnly: true,
      version: 'TEST-ONLY-GUI-1',
      classify: (r) => r.data.text
    });
    classifier.confirmClassification(preview.operationId, 'accept_complete');
    await createArchiveService({ store, classification: classifier }).saveArchive(
      preview.operationId
    );
    classifier.close();
    store.close();
    let app;
    const errors = [];
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
          `--user-data-dir=${data}`
        ],
        env: {
          ...process.env,
          XDG_CONFIG_HOME: path.join(root, 'config'),
          XDG_CACHE_HOME: path.join(root, 'cache')
        }
      });
      assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), fs.realpathSync(data));
      const page = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
      );
      page.on('pageerror', (e) => errors.push(e.message));
      await page.locator('[data-action="generate"]').first().waitFor();
      return page;
    }
    let page = await launch();
    const external = [];
    await app.context().route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname !== '127.0.0.1') {
        external.push(u.origin);
        return route.abort();
      }
      return route.continue();
    });
    await page.locator('[data-input="locale"]').selectOption('GB');
    await page.locator('[data-input="type"]').selectOption('tech');
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const card = await page.evaluate(() => window.blego.lastCard());
    assert.equal(card.type, 'tech');
    assert.equal(card.country, 'GB');
    async function checkClipboard(expected) {
      let actual;
      for (let i = 0; i < 100; i++) {
        actual = await app.evaluate(({ clipboard }) => clipboard.readText());
        if (actual === expected) return;
        await page.waitForTimeout(10);
      }
      assert.equal(actual, expected);
    }
    const extraFields = page.locator('details.ux-extra-fields');
    if (await extraFields.count()) await extraFields.locator('summary').click();
    for (const field of card.fieldOrder) {
      await page.locator(`[aria-label="Copy ${field}"]`).click();
      await checkClipboard(
        Array.isArray(card.fields[field])
          ? card.fields[field].join(', ')
          : String(card.fields[field])
      );
    }
    await page.getByText('Copy full set', { exact: true }).click();
    await checkClipboard(
      card.fieldOrder
        .map(
          (f) =>
            `${f}: ${Array.isArray(card.fields[f]) ? card.fields[f].join(', ') : card.fields[f]}`
        )
        .join('\n')
    );
    await page.locator('.toasts').getByText('Copied', { exact: true }).first().waitFor();
    await page.locator('.sidebar [data-view="settings"]').click();
    await page.locator('[name="symbols"]').fill('★');
    await page.locator('#settings-form button[type="submit"]').click();
    await waitForAsync(page, async () => (await window.blego.getSettings()).symbols === '★');
    // The dialog is the permission boundary; replace only the native chooser with a
    // controlled fixture, exercising real preview, apply, settings and storage.
    const poolFile = path.join(root, 'female-data.json');
    const dataset = JSON.parse(fs.readFileSync('resources/generator/countries/GB.json', 'utf8'));
    dataset.first = ['Olivia'];
    dataset.datasetVersion = 'GUI-TEST-2';
    delete dataset.checksum;
    dataset.checksum = require('node:crypto')
      .createHash('sha256')
      .update(JSON.stringify(dataset))
      .digest('hex');
    fs.writeFileSync(poolFile, JSON.stringify(dataset));
    async function openAdvancedSettings() {
      const advanced = page.locator('details.ux-settings-advanced');
      if (await advanced.count()) {
        if (!(await advanced.evaluate((element) => element.open)))
          await advanced.locator('summary').click();
      }
    }
    async function choosePoolFixture() {
      await app.evaluate(({ dialog }, file) => {
        const original = dialog.showOpenDialog;
        dialog.showOpenDialog = async () => {
          dialog.showOpenDialog = original;
          return { canceled: false, filePaths: [file] };
        };
      }, poolFile);
      await openAdvancedSettings();
      await page.locator('[data-action="pool-choose"]').click();
      await page.locator('[data-action="pool-apply"]').waitFor({ state: 'attached' });
      await openAdvancedSettings();
    }
    await choosePoolFixture();
    assert.equal(
      (await page.evaluate(() => window.blego.getPoolStats({ country: 'GB', type: 'tech' }))).counts
        .firstNames,
      1563
    );
    await page.locator('[data-action="pool-cancel"]').click();
    await page.locator('[data-action="pool-apply"]').waitFor({ state: 'detached' });
    await choosePoolFixture();
    await page.locator('[data-action="pool-apply"]').click();
    await waitForAsync(
      page,
      async () =>
        (await window.blego.getPoolStats({ country: 'GB', type: 'tech' })).counts.firstNames === 1
    );
    await openAdvancedSettings();
    await page.locator('[name="bulkMode"]').check();
    await page.locator('#settings-form button[type="submit"]').click();
    await waitForAsync(page, async () => (await window.blego.getSettings()).bulkMode === true);
    await openAdvancedSettings();
    await page.locator('[data-action="pool-bundled"]').click();
    await waitForAsync(
      page,
      async () =>
        (await window.blego.getPoolStats({ country: 'GB', type: 'tech' })).counts.firstNames ===
        1563
    );
    await page.locator('[data-view="checker"]').click();
    await page
      .locator('#checker-input')
      .fill('0012345678901234567890123\nhttps://facebook.com/groups');
    await page.locator('[data-action="checker-run"]').click();
    await page.locator('#fb-note-status-0').waitFor();
    assert.equal(await page.locator('[data-action="checker-status"]').isDisabled(), true);
    await page.locator('[aria-label="Copy Facebook ID"]').first().click();
    await checkClipboard('0012345678901234567890123');
    await page.locator('#fb-note-status-0').selectOption('blocked');
    await page.locator('#fb-note-comment-0').fill('Synthetic owner report');
    await page.locator('[data-action="facebook-note"]').click();
    await page.getByText('1 owner reports', { exact: true }).waitFor();
    assert.equal(
      await page.getByText('Unknown — public check cannot confirm a ban', { exact: true }).count(),
      2
    );
    const disabled = await page.evaluate(async () => {
      try {
        await window.blego.checkFacebook({
          targets: [{ canonicalUrl: 'https://www.facebook.com/alice' }],
          runId: 'test-disabled'
        });
        return false;
      } catch (error) {
        return error.message === 'MODULE_DISABLED';
      }
    });
    assert.equal(disabled, true);
    const imageFile = await require('../fixtures/images.cjs').imageFixture(root, 'png', {
      name: '- тест.png'
    });
    await app.evaluate(({ dialog }, file) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = original;
        return { canceled: false, filePaths: [file] };
      };
    }, imageFile);
    await page.locator('[data-view="photos"]').click();
    await page.locator('[data-action="images-choose"]').click();
    await page.locator('#metadata-form').waitFor();
    await page.locator('[name="action-title"]').selectOption('set');
    await page.locator('[name="value-title"]').fill('Новый заголовок');
    const imageOutput = path.join(root, 'image-output');
    fs.mkdirSync(imageOutput);
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => {
        return { canceled: false, filePaths: [directory] };
      };
    }, imageOutput);
    await page.locator('#metadata-form [type="submit"]').click();
    await page.locator('[data-metadata-plan]').waitFor();
    assert.equal(await page.locator('[name="action-title"]').inputValue(), 'set');
    assert.equal(await page.locator('[name="value-title"]').inputValue(), 'Новый заголовок');
    await page.locator('[name="value-title"]').fill('Другой заголовок');
    assert.equal(await page.locator('[data-metadata-plan]').count(), 0);
    await page.locator('#metadata-form [type="submit"]').click();
    await page.locator('[data-action="metadata-export"]').click();
    await page.locator('[data-action="metadata-report"]').first().waitFor();
    assert.match(await page.locator('[data-metadata-progress]').textContent(), /completed/);
    assert.equal(fs.readdirSync(imageOutput).length, 1);
    const copy = path.join(imageOutput, fs.readdirSync(imageOutput)[0]);
    const readback = await require('../../electron/features/images/engine.cjs')
      .createEngine()
      .read(copy);
    assert.equal(readback.tags['XMP-dc:Title'], 'Другой заголовок');

    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'кириллица.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Привет\nмир')
    });
    await page.locator('[data-classifier-status]').waitFor();
    await page
      .locator('details')
      .filter({ has: page.locator('[data-action="import-copy"]') })
      .locator('summary')
      .first()
      .click();
    await page.locator('[data-action="import-copy"]').click();
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'Привет\nмир');
    await page.locator('[data-view="history"]').click();
    await page.locator('[data-action="archive-open"]').click();
    await page.getByText('Тестовый результат', { exact: true }).waitFor();
    fs.mkdirSync('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/archive-linux.png', fullPage: true });
    await page.locator('[data-view="generator"]').click();
    await page.screenshot({ path: 'artifacts/generator-linux.png', fullPage: true });
    assert.deepEqual(external, []);
    assert.ok(!(await page.locator('.toasts').textContent()).includes('Copy failed'));
    await app.close();
    app = null;
    page = await launch();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), card);
    assert.equal((await page.evaluate(() => window.blego.getSettings())).symbols, '★');
    await page.locator('[data-view="history"]').click();
    await page.locator('[data-action="archive-open"]').click();
    await page.getByText('Тестовый результат', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await page.locator('[data-view="generator"]').click();
    await app.evaluate(({ clipboard }) => {
      globalThis.__originalClipboardWrite = clipboard.writeText;
      clipboard.writeText = async () => {
        throw Error('TEST_COPY_FAILURE');
      };
    });
    await page.evaluate(() => document.querySelector('.toasts').replaceChildren());
    await page.locator('[aria-label="Copy phone"]').click();
    await page.getByText('Copy failed. Select the text manually.', { exact: true }).waitFor();
    assert.ok(!(await page.locator('.toasts').textContent()).includes('Copied'));
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = globalThis.__originalClipboardWrite;
      delete globalThis.__originalClipboardWrite;
    });
  }
);
