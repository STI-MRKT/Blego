const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');

test(
  'restored quick workflow keeps generator compact and network telemetry visual',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-ux-'));
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
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.locator('[data-action="generate"]').first().waitFor();
    await page.evaluate(() => window.blego.markTour()).catch(() => {});
    await page.locator('[data-action="generate"]').first().click();
    await page.locator('.demo-card').waitFor();
    await page.waitForTimeout(900);
    const tourSkip = page.locator('[data-tour-action="skip"]');
    if (await tourSkip.isVisible()) await tourSkip.click();
    await page.locator('.page-head .ux-copy-actions [data-copy-action="open"]').click();
    await page.locator('[data-copy-control="format"]').waitFor();
    await page.locator('[data-copy-action="close"]').click();

    if (process.env.BLEGO_CAPTURE_UX === '1') {
      fs.mkdirSync('release', { recursive: true });
      await page.evaluate(() => document.getElementById('toasts')?.replaceChildren());
      await page.screenshot({ path: 'release/ux-generator.png' });
    }
    assert.equal(await page.locator('.ux-generator .ux-copy-set').isVisible(), true);
    assert.equal(await page.locator('#news-block').count(), 0);
    const profile = await page.evaluate(() => window.blego.lastCard());
    if (profile?.fields?.phone) {
      const shownPhone = await page
        .locator('.field')
        .filter({ has: page.locator('[aria-label="Copy phone"]') })
        .locator('.field-value')
        .innerText();
      assert.notEqual(shownPhone, profile.fields.phone);
      assert.equal(shownPhone.replace(/[^0-9]/g, ''), profile.fields.phone.replace(/[^0-9]/g, ''));
    }
    for (const country of ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB']) {
      await page.locator('[data-input="locale"]').selectOption(country);
      await page.locator('[data-action="generate"]').first().click();
      await page.waitForFunction(
        () =>
          !!document.querySelector('.demo-card') &&
          !document.querySelector('[data-action="generate"]').disabled
      );
      const saved = await page.evaluate(() => window.blego.lastCard());
      assert.equal(saved.country, country);
      const national = saved.fields.phone.slice(
        { BR: 2, US: 1, FR: 2, PL: 2, DE: 2, ES: 2, IT: 2, GB: 2 }[country] + 1
      );
      await page.getByRole('button', { name: 'Copy phone', exact: true }).click();
      for (let i = 0; i < 40; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === national) break;
        await page.waitForTimeout(25);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), national);
    }
    const category = page.locator('.row-chips button').first();
    const categoryText = await category.innerText();
    await category.click();
    for (let i = 0; i < 40; i++) {
      if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === categoryText) break;
      await page.waitForTimeout(25);
    }
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), categoryText);
    await page.locator('[data-view="news"]').click();
    await page.locator('#news-block').waitFor();
    await page.locator('[data-view="generator"]').click();

    const extra = page.locator('details.ux-extra-fields');
    assert.equal(await extra.count(), 0);

    await page.locator('[data-view="network"]').click();
    await page.locator('.gauge-wrap').waitFor();
    assert.equal(await page.locator('.gauge').isVisible(), true);
    assert.equal(await page.locator('.packets').isVisible(), true);
    assert.equal(await page.locator('[data-action="net-ping"]').count(), 0);
    assert.equal(await page.locator('[data-action="net-enable"]').isVisible(), true);
    assert.equal(await page.locator('[data-action="net-run"]').isDisabled(), true);

    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.network.ping = {
        targets: [
          { label: 'Cloudflare', ms: 18 },
          { label: 'Quad9', ms: 36 }
        ],
        best: 18,
        jitter: 18
      };
      state.network.speed = { mbps: 96.5, bytes: 10000000, ttfb: 31 };
    });
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-view="network"]').click();
    assert.equal(await page.locator('.ping-row').count(), 0);
    if (process.env.BLEGO_CAPTURE_UX === '1')
      await page.screenshot({ path: 'release/ux-network.png' });
    assert.equal(await page.locator('#speed-value').getAttribute('data-value'), '96.5');
    assert.equal(await page.getByText('Connection Quality', { exact: true }).count(), 1);
    assert.equal(await page.getByText('IP Trust', { exact: true }).count(), 1);

    await page.locator('[data-view="settings"]').click();
    await page.locator('details.ux-settings-advanced').waitFor();
    assert.equal(
      await page.locator('details.ux-settings-advanced').evaluate((element) => element.open),
      false
    );
    assert.equal(await page.locator('[name="proxyEnabled"]').isVisible(), true);
    if (process.env.BLEGO_CAPTURE_UX === '1')
      await page.screenshot({ path: 'release/ux-settings.png' });
    await page.locator('[data-view="photos"]').click();
    await page.locator('[data-action="images-choose"]').waitFor();
    if (process.env.BLEGO_CAPTURE_UX === '1')
      await page.screenshot({ path: 'release/ux-photos.png' });
  }
);
