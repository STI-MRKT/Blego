const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { imageFixture } = require('../fixtures/images.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'late image preview cannot replace another image or reopen after close or selection change',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-preview-race-')),
      data = path.join(root, 'data');
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(data, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
    const files = [
      await imageFixture(root, 'png', { name: 'A.png' }),
      await imageFixture(root, 'png', { name: 'B.png' })
    ];
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
    await page.locator('[data-view="photos"]').click();
    await app.evaluate(({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
    }, files);
    await page.locator('[data-action="images-choose"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.photos.length === 2 && !state.imagesBusy;
    });
    const ids = await page
      .locator('[data-action="image-preview"]')
      .evaluateAll((es) => es.map((e) => e.dataset.id));
    const uri = await page.evaluate((id) => window.blego.previewImage(id), ids[0]);
    await app.evaluate(({ ipcMain }, uri) => {
      globalThis.previewPending = {};
      ipcMain.removeHandler('local:imagePreview');
      ipcMain.handle(
        'local:imagePreview',
        (_e, { fileId }) =>
          new Promise(
            (resolve) =>
              (globalThis.previewPending[fileId] = () =>
                resolve({ ok: true, value: uri + '#' + fileId }))
          )
      );
    }, uri);
    const open = async (i) => {
      await page.locator(`[data-action="image-preview"][data-id="${ids[i]}"]`).click();
      for (let k = 0; k < 100; k++) {
        if (await app.evaluate((_electron, id) => !!globalThis.previewPending[id], ids[i])) return;
        await page.waitForTimeout(10);
      }
      throw Error('No pending preview');
    };
    const resolve = async (i) => {
      await app.evaluate((_electron, id) => {
        globalThis.previewPending[id]();
        delete globalThis.previewPending[id];
      }, ids[i]);
      await page.waitForTimeout(100);
    };
    await open(0);
    await open(1);
    await resolve(1);
    await resolve(0);
    assert.equal(
      await page.locator('figure.card img').getAttribute('src'),
      uri + '#' + ids[1],
      'late A must not replace B pixels'
    );
    assert.equal(
      await page.locator('figure.card figcaption').textContent(),
      'B.png',
      'late A cannot replace B'
    );
    await open(0);
    await page.locator('[data-action="image-preview-close"]').click();
    await resolve(0);
    assert.equal(await page.locator('figure.card').count(), 0, 'closed preview cannot reopen');
    await open(0);
    await page.locator('[data-image-select]').first().uncheck();
    await resolve(0);
    assert.equal(
      await page.locator('figure.card').count(),
      0,
      'selection change invalidates pending preview'
    );
  }
);
