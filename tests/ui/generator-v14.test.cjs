const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'generator copies exact Name/BIO from compact card, preserves full fields and reports native clipboard failure',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-generator-v14-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
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
    await page.locator('[data-action="generate"]').waitFor();
    await page.locator('[data-input="type"]').selectOption('tech');
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    assert.equal(await page.locator('.ux-extra-fields').count(), 0);
    const card = await page.evaluate(() => window.blego.lastCard());
    assert.equal(card.namingStrategy, 'brand_name');
    assert.match(card.fields.email, /@dayrep\.com$/);
    const name = 'Łucía Élodie — ' + 'Длинное имя '.repeat(12),
      bio = 'Портрет, lumière & art.\nСохраняем каждую строку — без изменений.';
    await page.evaluate(
      async ({ name, bio }) => {
        const { state } = await import('/js/state.js');
        state.demo.fields.name = name;
        state.demo.fields.bio = bio;
      },
      { name, bio }
    );
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="generator"]').click();
    async function clip(expected) {
      for (let i = 0; i < 80; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === expected) return;
        await page.waitForTimeout(25);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
    }
    const nameButton = page.locator('.demo-left [data-field="name"]'),
      bioButton = page.locator('.demo-left [data-field="bio"]');
    await nameButton.focus();
    await page.keyboard.press('Enter');
    await clip(name);
    await page.getByText('Имя скопировано', { exact: true }).waitFor();
    await bioButton.click();
    await clip(bio);
    await page.getByText('BIO скопировано', { exact: true }).waitFor();
    await page.locator('.ux-copy-set').click();
    const full = { ...card.fields, name, bio };
    await clip(
      card.fieldOrder
        .map((f) => `${f}: ${Array.isArray(full[f]) ? full[f].join(', ') : full[f]}`)
        .join('\n')
    );
    await page.evaluate(() => document.querySelector('.toasts').replaceChildren());
    await app.evaluate(({ clipboard }) => {
      globalThis.blegoTestWriteText = clipboard.writeText;
      clipboard.writeText = () => {
        throw Error('synthetic denied');
      };
    });
    await nameButton.click();
    await page.getByText(/Не удалось скопировать|Copy failed/).waitFor();
    assert.equal(await page.getByText('Имя скопировано', { exact: true }).count(), 0);
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = globalThis.blegoTestWriteText;
      delete globalThis.blegoTestWriteText;
    });
    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.demo.fields.bio = '';
    });
    await page.locator('[data-view="friends"]').click();
    await page.locator('[data-view="generator"]').click();
    assert.ok(await page.locator('.demo-left [data-field="bio"]').isDisabled());
  }
);
