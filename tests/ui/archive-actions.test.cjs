const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'original compact archive rows retain filters, individual copying, exact exports, folder and confirmed deletion',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-archive-ui-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    const { parseInput } = await import('../../shared/importer.mjs');
    const entries = [];
    // TEST-ONLY fixture archives isolate archive controls; production classifier has separate regressions.
    for (const [i, name] of ['Alpha.txt', 'Beta.txt'].entries()) {
      const classification = createClassificationService({
        allowTestRules: true,
        clock: () => new Date(`2026-01-0${i + 1}T10:00:00Z`)
      });
      const parsed = await parseInput({
        bytes: Buffer.from('Synthetic ' + name),
        originalName: name
      });
      const result = classification.classifyDocument(parsed, {
        testOnly: true,
        version: 'TEST-ONLY-ARCHIVE-UX',
        classify: (r) => r.data.text
      });
      classification.confirmClassification(result.operationId, 'accept_complete');
      entries.push(
        await createArchiveService({ store, classification }).saveArchive(result.operationId)
      );
      classification.close();
    }
    store.close();
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
    await page.locator('[data-view="history"]').click();
    assert.equal(
      await page.locator('.nav [data-view]').last().getAttribute('data-view'),
      'history'
    );
    await page.locator('.hlist .hrow').first().waitFor();
    assert.equal(await page.locator('.hrow').count(), 2);
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'archive.png') });
    }
    assert.ok(!/Last opened|ZIP:|Source:/.test(await page.locator('#view').textContent()));
    await page.locator('[name="search"]').fill('Beta');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.archives.total === 1;
    });
    assert.equal(await page.locator('.hrow .nm').textContent(), 'Beta.txt');
    await page.locator('[aria-label="Copy archive filename"]').click();
    await page.waitForTimeout(30);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'Beta.txt');
    await page.locator('[name="search"]').fill('');
    await page.locator('#archive-filter details > summary').click();
    await page.locator('[name="order"]').selectOption('oldest');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.archives.total === 2 && state.archives.items[0].originalName === 'Alpha.txt';
    });
    await page.locator('[data-action="archive-open"]').first().click();
    await page.getByText('Synthetic Alpha.txt', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Copy result', exact: true }).click();
    await page.waitForTimeout(30);
    assert.equal(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
      'Synthetic Alpha.txt'
    );
    await app.evaluate(({ dialog, shell }, root) => {
      globalThis.archiveFolderRequests = [];
      globalThis.archiveDeleteResponse = 0;
      dialog.showSaveDialog = async (_window, options) => ({
        canceled: false,
        filePath: root + (options.defaultPath.endsWith('.txt') ? '/export.txt' : '/export.zip')
      });
      dialog.showMessageBox = async () => ({ response: globalThis.archiveDeleteResponse });
      shell.showItemInFolder = (file) => globalThis.archiveFolderRequests.push(file);
    }, root);
    await page.getByRole('button', { name: 'Export TXT', exact: true }).click();
    await page.getByRole('button', { name: 'Export ZIP', exact: true }).click();
    for (let i = 0; i < 50 && !fs.existsSync(path.join(root, 'export.zip')); i++)
      await page.waitForTimeout(30);
    assert.equal(fs.readFileSync(path.join(root, 'export.txt'), 'utf8'), 'Synthetic Alpha.txt');
    assert.deepEqual(
      fs.readFileSync(path.join(root, 'export.zip')),
      fs.readFileSync(path.join(entries[0].archiveRoot, entries[0].fileName))
    );
    await page.getByRole('button', { name: 'Open folder', exact: true }).click();
    assert.equal((await app.evaluate(() => globalThis.archiveFolderRequests)).length, 1);
    await page.getByRole('button', { name: 'Delete…', exact: true }).click();
    assert.equal((await page.evaluate(() => window.blego.listArchives())).total, 2);
    await app.evaluate(() => (globalThis.archiveDeleteResponse = 1));
    await page.getByRole('button', { name: 'Delete…', exact: true }).click();
    await waitForAsync(page, async () => (await window.blego.listArchives()).total === 1);
    assert.equal(
      (await page.evaluate(() => window.blego.listArchives())).items[0].originalName,
      'Beta.txt'
    );
  }
);
