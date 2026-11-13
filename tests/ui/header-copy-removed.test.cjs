const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');

test('no injected Copy button in any page header; direct and advanced copying remain usable', { timeout: 90000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-no-header-copy-'));
  const data = path.join(root, 'data');
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
  await page.locator('[data-tab="profile"]').waitFor();
  const assertNoHeaderCopy = async () => {
    assert.equal(await page.locator('.page-head [data-copy-action="open"]').count(), 0);
    assert.equal(await page.locator('[data-copy-action="open"]').count(), 0);
    assert.equal(await page.locator('.page-head').getByRole('button', { name: 'Копировать', exact: true }).count(), 0);
  };

  await assertNoHeaderCopy();
  await page.locator('[data-action="generate"]').click();
  await page.locator('.demo-card').waitFor();
  await assertNoHeaderCopy();

  const profile = await page.evaluate(() => window.blego.lastCard());
  await page.locator('[aria-label="Копировать имя"]').click();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), profile.fields.name);
  await page.locator('.ux-copy-set').click();
  assert.ok((await app.evaluate(({ clipboard }) => clipboard.readText())).includes(profile.fields.email));

  // The advanced selection/format panel is available without a visible header button.
  await page.keyboard.press('Control+Alt+Shift+C');
  await page.locator('[data-copy-control="format"]').waitFor();
  assert.equal(await page.locator('[data-copy-action="open"]').count(), 0);
  await page.locator('[data-copy-action="close"]').click();

  await page.locator('[data-tab="bio"]').click();
  await page.locator('#bio-country').waitFor();
  await assertNoHeaderCopy();

  for (const view of ['import', 'news', 'network', 'photos', 'friends', 'checker', 'history']) {
    await page.locator(`[data-view="${view}"]`).first().click();
    await page.waitForFunction(async (expected) => (await import('/js/state.js')).state.view === expected, view);
    await assertNoHeaderCopy();
  }
});
