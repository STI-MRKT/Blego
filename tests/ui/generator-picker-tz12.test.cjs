const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');

test(
  'TZ12 shared generator picker preserves FP appearance, keyboard selection, city identity and narrow-window placement',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-picker-tz12-'));
    const store = await openStore(root);
    store.set('tourSeen', true);
    updateSettings(store, { country: 'GB', type: 'model', newsEnabled: false });
    store.close();
    const app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    const fp = page.locator('[data-input="locale"]');
    await fp.waitFor();
    const style = (el) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(
        [
          'height',
          'borderRadius',
          'backgroundColor',
          'borderColor',
          'fontSize',
          'paddingLeft',
          'paddingRight',
          'backgroundImage'
        ].map((k) => [k, s[k]])
      );
    };
    const reference = await fp.evaluate(style);
    await fp.focus();
    await fp.press('ArrowDown');
    assert.equal(await page.locator('#generator-picker-list [role="option"]').count(), 8);
    await fp.press('Home');
    await fp.press('ArrowDown');
    await fp.press('Enter');
    assert.equal(await fp.inputValue(), 'US');
    await fp.press('ArrowDown');
    await fp.press('Escape');
    assert.equal(await page.locator('#generator-picker-list').count(), 0);
    assert.equal(await fp.inputValue(), 'US');
    await page.locator('[data-tab="bio"]').click();
    const country = page.locator('#bio-country');
    await country.waitFor();
    assert.deepEqual(await country.evaluate(style), reference);
    await country.selectOption('US');
    await page.waitForFunction(() => document.querySelectorAll('#bio-cities option').length > 0);
    // Two same-name cities must retain the exact selected postal identity.
    await page.evaluate(async () => {
      const { state } = await import('./js/state.js');
      state.bioCities = [
        { city: 'Springfield', region: 'Illinois', postalCode: '62701' },
        { city: 'Springfield', region: 'Massachusetts', postalCode: '01103' }
      ];
    });
    const city = page.locator('#bio-city');
    await city.fill('Spring');
    assert.equal(await page.locator('#generator-picker-list [role="option"]').count(), 2);
    await city.press('ArrowDown');
    await city.press('Enter');
    assert.equal(await city.inputValue(), 'Springfield');
    assert.equal(
      await page.evaluate(
        async () => (await import('./js/state.js')).state.bioParamsEditor.values.postalCode
      ),
      '01103'
    );
    await city.fill('Springfield ');
    assert.equal(
      await page.evaluate(
        async () => (await import('./js/state.js')).state.bioParamsEditor.values.postalCode
      ),
      ''
    );
    await city.press('Escape');
    await country.selectOption('GB');
    await city.fill('London');
    await page.locator('#bio-type').selectOption('model');
    await page.locator('[data-action="bio-generate"]').click();
    await page.locator('#bio-mainBio').waitFor();
    const output = process.env.BLEGO_CAPTURE;
    if (output) fs.mkdirSync(output, { recursive: true });
    for (const width of [360, 390, 480, 576, 768, 980, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const selector of [
        '#bio-country',
        '#bio-city',
        '#bio-type',
        '[data-bio-institution="university"]',
        '[data-bio-institution="school"]'
      ]) {
        const control = page.locator(selector);
        await control.scrollIntoViewIfNeeded();
        await control.click();
        await page.locator('#generator-picker-list').waitFor();
        const bounds = await page.locator('#generator-picker-list').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${selector} at ${width}`);
        assert.ok(
          bounds.y >= 0 && bounds.y + bounds.height <= 1001,
          `${selector} vertical at ${width}`
        );
        if (output)
          await page.screenshot({
            path: path.join(output, `tz12-picker-${selector.replace(/[^a-z]/g, '')}-${width}.png`),
            animations: 'disabled'
          });
        await control.press('Escape');
        assert.equal(await page.locator('#generator-picker-list').count(), 0);
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false
      );
    }
    await page.locator('#bio-country').click();
    await page.setViewportSize({ width: 390, height: 600 });
    await page.waitForFunction(() => {
      const box = document.getElementById('generator-picker-list')?.getBoundingClientRect();
      return box && box.x >= 0 && box.right <= innerWidth;
    });
    const resized = await page.locator('#generator-picker-list').boundingBox();
    assert.ok(resized.x + resized.width <= 391);
    await country.press('Tab');
    assert.equal(await page.locator('#generator-picker-list').count(), 0);
    await page.locator('[data-tab="profile"]').click();
    assert.equal(await fp.inputValue(), 'US');
  }
);
