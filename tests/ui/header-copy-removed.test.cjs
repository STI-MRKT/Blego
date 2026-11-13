const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');

test(
  'all10 views have no general header Copy before/after generation/import/resize/restart; all FP/BIO copies remain exact',
  { timeout: 90000 },
  async (t) => {
    const f = await fixture(t);
    let page = await f.launch();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const noHeader = async () => {
      assert.equal(await page.locator('[data-copy-action="open"]').count(), 0);
      assert.equal(
        await page.locator('.page-head #copy-actions,.page-head #copy-panel').count(),
        0
      );
      assert.equal(
        await page
          .locator('.page-head')
          .getByRole('button', { name: /^(Копировать|Copy)$/i })
          .count(),
        0
      );
      assert.equal(
        await page.locator('#copy-actions').count(),
        0,
        'no invisible mount when menu is closed'
      );
    };
    const clip = () => f.app.evaluate(({ clipboard }) => clipboard.readText());
    await noHeader();
    const fp = await generate(page);
    await noHeader();
    const { nationalPhoneForCopy } = await import('../../src/js/utils/phone.mjs');
    for (const field of [
      'name',
      'phone',
      'email',
      'address',
      'city',
      'postalCode',
      'handle',
      'bio'
    ]) {
      await page
        .locator(`[data-action="copy-model"][data-source="generator"][data-field="${field}"]`)
        .first()
        .click();
      assert.equal(
        await clip(),
        field === 'phone' ? nationalPhoneForCopy(fp.fields.phone, fp.country) : fp.fields[field],
        field
      );
    }
    const { profileText } = await import('../../src/js/services/generator.js');
    await page.locator('.ux-copy-set').click();
    assert.equal(await clip(), profileText(fp));
    for (const modifier of ['Control', ...(process.platform === 'darwin' ? ['Meta'] : [])]) {
      await f.app.evaluate(({ clipboard }) => clipboard.writeText('shortcut sentinel'));
      await shortcut(page, `${modifier}+Shift+C`);
      for (let i = 0; (await clip()) !== profileText(fp); i++) {
        assert.ok(i < 100);
        await page.waitForTimeout(10);
      }
      await shortcut(page, `${modifier}+Alt+Shift+C`);
      await page.locator('[data-copy-control="format"]').waitFor();
      await page.locator('[data-copy-action="close"]').click();
      await noHeader();
    }
    await page.locator('[data-tab="bio"]').click();
    await noHeader();
    await page.locator('#bio-country').selectOption('GB');
    await page.locator('#bio-city').fill('London');
    await page.locator('#bio-type').selectOption('tech');
    await page.locator('[data-action="bio-generate"]').click();
    await page.locator('#bio-mainBio').waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="bio-generate"]').disabled
    );
    await noHeader();
    const bio = await page.evaluate(
      async () => (await window.blego.biography({ action: 'read' })).record
    );
    for (const [field, value] of Object.entries(bio.values)) {
      assert.ok(value, field);
      await page.locator(`[data-action="bio-copy"][data-field="${field}"]`).click();
      assert.equal(await clip(), value, field);
    }
    await page.locator('#bio-mainBio').fill('Saved independent BIO without header copy');
    await waitForAsync(
      page,
      async () =>
        (await window.blego.biography({ action: 'read' })).record.values.mainBio ===
        'Saved independent BIO without header copy'
    );
    await page.locator('[data-tab="profile"]').click();
    await noHeader();
    await page.locator('[data-tab="bio"]').click();
    await noHeader();
    assert.equal(
      await page.locator('#bio-mainBio').inputValue(),
      'Saved independent BIO without header copy'
    );
    for (const width of [360, 390, 427, 480, 504, 576, 768, 980, 1280]) {
      await f.app.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()[0].setBounds({ width, height: 900 }),
        width
      );
      await page.waitForFunction((width) => innerWidth === width, width);
      for (const tab of ['profile', 'bio']) {
        await page.locator(`[data-tab="${tab}"]`).click();
        await noHeader();
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
        );
        if (process.env.BLEGO_CAPTURE && [360, 1280].includes(width)) {
          await page.waitForFunction(() => !document.querySelector('.toast'));
          fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
          await page.waitForFunction(
            () => Number(getComputedStyle(document.querySelector('#view .page')).opacity) === 1
          );
          await page.screenshot({
            animations: 'disabled',
            path: path.join(process.env.BLEGO_CAPTURE, `tz8-${tab}-${width}.png`)
          });
        }
      }
    }
    // Import transitions re-render the page without creating the old header action.
    await page.locator('[data-view="import"]').click();
    await noHeader();
    await page.locator('#file-input').setInputFiles({
      name: 'copy-regression.tsv',
      mimeType: 'text/tab-separated-values',
      buffer: Buffer.from('id\tcookies\n0001\tFAKE_COOKIE_FOR_COPY_REGRESSION')
    });
    await page.locator('[data-classifier-status]').waitFor();
    await noHeader();
    for (const view of ['news', 'network', 'photos', 'friends', 'checker', 'history', 'settings']) {
      await page.locator(`[data-view="${view}"]`).first().click();
      await waitForAsync(
        page,
        async (expected) => (await import('/js/state.js')).state.view === expected,
        view
      );
      await noHeader();
    }
    await f.app.close();
    page = await f.launch();
    await noHeader();
    assert.deepEqual(await page.evaluate(() => window.blego.lastCard()), fp);
    await page.locator('[data-tab="bio"]').click();
    await noHeader();
    assert.equal(
      await page.locator('#bio-mainBio').inputValue(),
      'Saved independent BIO without header copy'
    );
    assert.deepEqual(errors, []);
  }
);

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-copy-keys-'));
  const store = await openStore(root);
  store.set('tourSeen', true);
  store.close();
  let app;
  async function launch() {
    app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    const page = await app.firstWindow();
    await page.locator('[data-tab="profile"]').waitFor();
    return page;
  }
  t.after(async () => {
    if (app) {
      await app
        .evaluate(({ ipcMain }) => {
          if (globalThis.copyHistoryOriginal)
            ipcMain._invokeHandlers.set('local:archiveList', globalThis.copyHistoryOriginal);
          globalThis.releaseCopyHistory?.();
        })
        .catch(() => {});
      await app.close();
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    launch,
    root,
    get app() {
      return app;
    }
  };
}
async function shortcut(page, keys = 'Control+Alt+Shift+C') {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.getSelection()?.removeAllRanges();
  });
  await page.keyboard.press(keys);
}
async function generate(page) {
  await page.locator('[data-action="generate"]').click();
  await page.locator('.demo-card').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-action="generate"]').disabled);
  return page.evaluate(() => window.blego.lastCard());
}
test(
  'advanced copy never resurrects after unsupported navigation or FP replacement/clear',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.launch();
    await generate(page);
    await shortcut(page);
    await page.locator('[data-copy-control="format"]').waitFor();
    await page.locator('[data-view="news"]').click();
    await page.locator('[data-view="generator"]').click();
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'returning must not reopen an old panel'
    );
    await shortcut(page);
    await page.locator('[data-copy-control="format"]').waitFor();
    await generate(page);
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'new card invalidates old panel'
    );
    await shortcut(page);
    await page.locator('[data-copy-control="format"]').waitFor();
    await page.locator('[data-action="clear-demo"]').click();
    await page.waitForFunction(() => !document.querySelector('.demo-card'));
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'clear invalidates old panel'
    );
    assert.equal(await page.locator('[data-copy-action="open"]').count(), 0);
  }
);
test(
  'copy shortcuts respect text editing, native copy, selection, empty data and key repeat',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.launch();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const initialPreferences = await page.evaluate(() => window.blego.copyPreferences());
    // Empty source shortcuts must remain harmless, including previewing the empty advanced menu.
    await f.app.evaluate(({ clipboard }) => clipboard.writeText('empty sentinel'));
    await shortcut(page, 'Control+Shift+C');
    await page.waitForTimeout(80);
    assert.equal(await f.app.evaluate(({ clipboard }) => clipboard.readText()), 'empty sentinel');
    if (await page.locator('[data-copy-action="close"]').count())
      await page.locator('[data-copy-action="close"]').click();
    await shortcut(page);
    await page.locator('[data-copy-action="preview"]').click();
    await page
      .locator('#copy-preview')
      .getByText(/0 rows/)
      .waitFor();
    assert.deepEqual(
      await page.evaluate(() => window.blego.copyPreferences()),
      initialPreferences,
      'empty source must not erase saved full-set field order'
    );
    await page.locator('[data-copy-action="close"]').click();
    await generate(page);
    await page.evaluate(() => {
      const editor = document.createElement('div');
      editor.id = 'copy-editable-fixture';
      editor.setAttribute('contenteditable', '');
      editor.textContent = 'Native selected text';
      editor.tabIndex = 0;
      document.querySelector('.page-head').append(editor);
    });
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.locator('#copy-editable-fixture').focus();
    await page.keyboard.press(`${modifier}+A`);
    await page.keyboard.press(`${modifier}+C`);
    assert.equal(
      await f.app.evaluate(({ clipboard }) => clipboard.readText()),
      'Native selected text'
    );
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+Alt+Shift+C');
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'contenteditable empty attribute is still editable'
    );
    await page.locator('#copy-editable-fixture').evaluate((el) => {
      el.setAttribute('contenteditable', 'plaintext-only');
      el.focus();
    });
    await page.keyboard.press('Control+Alt+Shift+C');
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'plaintext-only editor must retain shortcut'
    );
    await page.locator('#copy-editable-fixture').evaluate((el) => el.remove());
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      window.getSelection().selectAllChildren(document.querySelector('.page-head h1'));
    });
    await page.keyboard.press('Control+Alt+Shift+C');
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'selected ordinary text retains native copy'
    );
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.locator('[data-input="locale"]').focus();
    await page.keyboard.press('Control+Alt+Shift+C');
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'native selects keep their keyboard interaction'
    );
    await shortcut(page);
    await page.locator('[data-copy-control="format"]').waitFor();
    await page.locator('[data-copy-control="format"]').selectOption('json');
    for (let i = 0; i < 3; i++) await page.locator('[data-view="generator"]').click();
    assert.equal(await page.locator('#copy-actions').count(), 1);
    assert.equal(
      await page.locator('[data-copy-control="format"]').inputValue(),
      'json',
      'same-record repaint preserves the active form'
    );
    for (const width of [360, 1280]) {
      await f.app.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()[0].setBounds({ width, height: 900 }),
        width
      );
      await page.waitForFunction((width) => innerWidth === width, width);
      const bounds = await page.locator('#copy-panel').boundingBox();
      assert.ok(bounds.width > 100 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await page.locator('[data-copy-control="format"]').inputValue(), 'json');
    }

    await page.evaluate(() => {
      document.activeElement?.blur?.();
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          code: 'KeyC',
          key: 'C',
          ctrlKey: true,
          altKey: true,
          shiftKey: true,
          repeat: true
        })
      );
    });
    assert.equal(
      await page.locator('[data-copy-control="format"]').inputValue(),
      'json',
      'auto-repeat must not reset menu'
    );
    assert.deepEqual(errors, []);
  }
);
test(
  'late advanced copy requests cannot reopen a panel after navigation away and back',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t);
    const page = await f.launch();
    await page.locator('[data-view="history"]').click();
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.copyHistoryOriginal = ipcMain._invokeHandlers.get('local:archiveList');
      ipcMain._invokeHandlers.set('local:archiveList', async (e, arg) => {
        if (!globalThis.copyHistoryDelayed) {
          globalThis.copyHistoryDelayed = true;
          await new Promise((resolve) => {
            globalThis.releaseCopyHistory = resolve;
          });
        }
        return globalThis.copyHistoryOriginal(e, arg);
      });
    });
    await shortcut(page);
    for (let i = 0; !(await f.app.evaluate(() => Boolean(globalThis.releaseCopyHistory))); i++) {
      assert.ok(i < 100);
      await page.waitForTimeout(10);
    }
    await page.locator('[data-view="news"]').click();
    await page.locator('[data-view="history"]').click();
    await f.app.evaluate(() => globalThis.releaseCopyHistory());
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('[data-copy-control="format"]').count(),
      0,
      'late request must be invalidated by navigation'
    );
  }
);

test(
  'changing the active photo group invalidates the prepared group snapshot',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t),
      page = await f.launch();
    const { imageFixture } = require('../fixtures/images.cjs');
    const file = await imageFixture(f.root, 'png');
    await page.locator('[data-view="photos"]').click();
    await f.app.evaluate(({ dialog }, file) => {
      const original = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => {
        dialog.showOpenDialog = original;
        return { canceled: false, filePaths: [file] };
      };
    }, file);
    await page.locator('[data-action="images-choose"]').click();
    await page.locator('#metadata-form').waitFor();
    await page.locator('#image-groups-advanced > summary').click();
    await page.locator('#image-group-name').fill('Group A');
    await page.locator('[data-action="group-create"]').click();
    await page.waitForFunction(() =>
      document.querySelector('#image-group option:checked').textContent.includes('Group A')
    );
    const groupA = await page.locator('#image-group').inputValue();
    await page.locator('[data-action="group-move"]').click();
    await page.waitForFunction(() =>
      document.querySelector('#image-group option:checked').textContent.includes('(1)')
    );
    await page.locator('#image-group-name').fill('Group B');
    await page.locator('[data-action="group-create"]').click();
    await page.waitForFunction(() =>
      document.querySelector('#image-group option:checked').textContent.includes('Group B')
    );
    const groupB = await page.locator('#image-group').inputValue();
    await page.locator('#image-group').selectOption(groupA);
    await shortcut(page);
    await page.locator('[data-copy-control="source"]').selectOption('image-group');
    await page.locator('[data-copy-action="preview"]').click();
    await page.locator('[data-copy-action="commit"]').waitFor();
    assert.match(await page.locator('#copy-preview').innerText(), /1 rows/);
    await page.locator('#image-group').selectOption(groupB);
    assert.equal(await page.locator('#copy-actions').count(), 0, 'old group snapshot must close');
    await shortcut(page);
    await page.locator('[data-copy-control="source"]').selectOption('image-group');
    await page.locator('[data-copy-action="preview"]').click();
    await page.locator('[data-copy-action="commit"]').waitFor();
    assert.match(await page.locator('#copy-preview').innerText(), /0 rows/);
  }
);
test(
  'sequential copy completion after navigation cannot advance or reopen a closed panel',
  { timeout: 45000 },
  async (t) => {
    const f = await fixture(t),
      page = await f.launch();
    await generate(page);
    await shortcut(page);
    await page.locator('[data-copy-action="sequence-copy"]').waitFor();
    await page.evaluate(() => {
      window.copyToastMessages = [];
      new MutationObserver((records) => {
        for (const r of records)
          for (const node of r.addedNodes) window.copyToastMessages.push(node.textContent);
      }).observe(document.querySelector('#toasts'), { childList: true });
    });
    await f.app.evaluate(({ ipcMain }) => {
      globalThis.copyClipboardOriginal = ipcMain._invokeHandlers.get('local:copy');
      ipcMain._invokeHandlers.set('local:copy', async (e, arg) => {
        await new Promise((resolve) => {
          globalThis.releaseCopyClipboard = resolve;
        });
        return globalThis.copyClipboardOriginal(e, arg);
      });
    });
    t.after(async () => {
      await f.app
        .evaluate(({ ipcMain }) => {
          ipcMain._invokeHandlers.set('local:copy', globalThis.copyClipboardOriginal);
          globalThis.releaseCopyClipboard?.();
        })
        .catch(() => {});
    });
    await page.locator('[data-copy-action="sequence-copy"]').click();
    for (let i = 0; !(await f.app.evaluate(() => Boolean(globalThis.releaseCopyClipboard))); i++) {
      assert.ok(i < 100);
      await page.waitForTimeout(10);
    }
    await page.locator('[data-view="news"]').click();
    await f.app.evaluate(() => globalThis.releaseCopyClipboard());
    await page.waitForFunction(() =>
      window.copyToastMessages.some((x) => /Скопировано|Copied/.test(x))
    );
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#copy-actions').count(), 0);
    assert.deepEqual(
      await page.evaluate(() =>
        window.copyToastMessages.filter((x) => !/Скопировано|Copied/.test(x))
      ),
      []
    );
  }
);
