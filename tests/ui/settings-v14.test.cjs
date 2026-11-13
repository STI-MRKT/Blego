const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright'),
  { openStore } = require('../../electron/local/store.cjs'),
  { updateSettings } = require('../../electron/local/settings.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'Russian primary Settings explain controls and each permission survives restart without changing unrelated preferences',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-settings-v14-'));
    const store = await openStore(root);
    store.set('tourSeen', true);
    updateSettings(store, {
      country: 'IT',
      type: 'crypto',
      symbols: '★',
      newsInterval: 180,
      newsTopic: 'finance',
      fieldOrder: ['name', 'email', 'phone'],
      disabledFields: ['status'],
      allowRepeats: ['bio'],
      includeOriginal: true,
      overrides: { common: { symbols: '★' } }
    });
    store.close();
    const launch = () =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${root}`
        ]
      });
    let app = await launch(),
      page = await app.firstWindow();
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    await page.locator('[data-view="settings"]').click();
    const text = await page.locator('.ux-settings-basics').textContent();
    for (const label of [
      'Страна по умолчанию',
      'Тип профиля по умолчанию',
      'Символы и отметки',
      'Разрешить проверку сети и прокси',
      'Разрешить проверку публичных Facebook-профилей',
      'Разрешить загрузку новостей'
    ])
      assert.ok(text.includes(label), label);
    assert.equal(await page.locator('.ux-settings-basics [data-setting-help]').count(), 6);
    let expected = await page.evaluate(() => window.blego.getSettings());
    const prefs = await page.evaluate(() => window.blego.copyPreferences());
    for (const field of ['proxyEnabled', 'facebookEnabled', 'newsEnabled']) {
      for (const value of [true, false, true]) {
        await page.locator(`[name="${field}"]`).setChecked(value);
        await page.locator('#settings-form button[type="submit"]').click();

        await waitForAsync(
          page,
          async ({ field, value }) => (await window.blego.getSettings())[field] === value,
          { field, value }
        );
        expected = { ...expected, [field]: value };
        assert.deepEqual(await page.evaluate(() => window.blego.getSettings()), expected);
        assert.deepEqual(await page.evaluate(() => window.blego.copyPreferences()), prefs);
      }
    }
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.locator('[data-view="settings"]').click();
    assert.deepEqual(await page.evaluate(() => window.blego.getSettings()), expected);
    for (const field of ['proxyEnabled', 'facebookEnabled', 'newsEnabled'])
      assert.ok(await page.locator(`[name="${field}"]`).isChecked());
  }
);
