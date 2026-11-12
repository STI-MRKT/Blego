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
      assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), data);
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
    await page.locator('[data-view="settings"]').click();
    await page.locator('[name="symbols"]').fill('★');
    await page.locator('#settings-form button[type="submit"]').click();
    await page.waitForFunction(async () => (await window.blego.getSettings()).symbols === '★');
    await page.locator('[data-view="import"]').click();
    await page.locator('#file-input').setInputFiles({
      name: 'кириллица.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Привет\nмир')
    });
    await page.getByText('rules_pending — Classification rules are not configured').waitFor();
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
