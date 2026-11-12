const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');

test(
  'original visual controls and individual values remain usable with advanced data folded',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-original-ux-'));
    const data = path.join(root, 'data');
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(data, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.locator('[data-view="network"]').click();
    assert.equal(await page.locator('.gauge').isVisible(), true);
    assert.equal(await page.locator('.packets').isVisible(), true);
    assert.equal(await page.locator('#proxy-input').getAttribute('type'), 'text');
    assert.equal(await page.locator('main pre:visible').count(), 0);
    assert.equal(
      await page.locator('.nav [data-view]').last().getAttribute('data-view'),
      'history'
    );
    await page.locator('[data-view="generator"]').click();
    await page.locator('[data-action="generate"]').first().click();
    await page.locator('.demo-card').waitFor();
    assert.notEqual(
      await page.locator('.avatar.xl').evaluate((el) => getComputedStyle(el).backgroundImage),
      'none'
    );
    assert.equal(await page.locator('#view > #copy-actions').count(), 0);
    const profile = await page.evaluate(() => window.blego.lastCard());
    for (const field of profile.fieldOrder) {
      const button = page.locator(`[aria-label="Copy ${field}"]`).first();
      if (!(await button.isVisible())) await page.locator('[data-profile-extra] > summary').click();
      await button.click();
      await page.waitForTimeout(30);
      assert.equal(
        await app.evaluate(({ clipboard }) => clipboard.readText()),
        Array.isArray(profile.fields[field])
          ? profile.fields[field].join(', ')
          : String(profile.fields[field])
      );
    }
    const primary = await page.locator('.demo-card .fields').first().boundingBox();
    assert.ok(primary.y < 550, 'main profile fields must remain near the top');
    assert.deepEqual(errors, []);
  }
);
