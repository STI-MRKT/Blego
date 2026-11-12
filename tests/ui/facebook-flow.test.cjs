const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
const { installFacebookFixture } = require('../fixtures/facebook-ui.cjs');
test(
  'one Check normalizes and checks public availability; copies and cancellation remain truthful',
  { timeout: 60000 },
  async (t) => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-fb-ui-'));
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
      fs.rmSync(data, { recursive: true, force: true });
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="checker"]').click();
    await installFacebookFixture(app);
    await page.locator('#checker-input').fill('001234567890123456789');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await page.getByText('Login required', { exact: true }).first().waitFor();
    assert.equal((await app.evaluate(() => globalThis.fbCalls)).length, 1);
    for (const [label, value] of [
      ['Copy Facebook ID', '001234567890123456789'],
      ['Copy Facebook link', 'https://www.facebook.com/profile.php?id=001234567890123456789'],
      ['Copy check result', 'Login required']
    ]) {
      await page.getByRole('button', { name: label, exact: true }).first().click();
      for (let i = 0; i < 50; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === value) break;
        await page.waitForTimeout(20);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), value);
    }
    assert.equal(await page.locator('[data-facebook-notes]').isVisible(), false);
    await installFacebookFixture(app, 1000);
    await page.locator('#checker-input').fill('https://m.facebook.com/alice\n123456789');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return state.checker.checking?.total === 2;
    });
    const calls = await app.evaluate(() => globalThis.fbCalls);
    assert.deepEqual(
      calls[0].targets.map((t) => t.canonicalUrl),
      ['https://www.facebook.com/alice', 'https://www.facebook.com/profile.php?id=123456789']
    );
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await page.getByText('Login required', { exact: true }).count(), 0);
    assert.ok((await page.locator('#view').textContent()).includes('Cancelled'));
    assert.ok(!/BANNED|NOT_BANNED/.test(await page.locator('#view').textContent()));
  }
);
