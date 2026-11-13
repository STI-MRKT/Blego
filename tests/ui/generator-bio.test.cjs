const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
test(
  'TZ06 BIO edits and individual copies survive navigation, 360px and restart',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-ui-')),
      data = path.join(root, 'data');
    const store = await openStore(data);
    store.set('tourSeen', true);
    store.close();
    let app;
    async function launch() {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${data}`
        ]
      });
      return app.firstWindow();
    }
    t.after(async () => {
      await app?.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    let page = await launch();
    await page.locator('[data-action="generate"]').click();
    await page.locator('.demo-card').waitFor();
    const profile = await page.evaluate(() => window.blego.lastCard());
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-residence').waitFor();
    const residence = await page.locator('#bio-residence').inputValue();
    assert.ok(residence.includes(profile.fields.city));
    await page.locator('#bio-birthplace').fill('Manual birthplace');
    await page.locator('[data-action="bio-work"]').click();
    await page.waitForFunction(() => document.querySelector('#bio-position').value.length > 0);
    await page.locator('[data-action="bio-generate"]').click();
    await page.waitForFunction(() => document.querySelector('#bio-mainBio').value.length > 0);
    await page.locator('#bio-mainBio').fill('My synthetic BIO 🧠');
    await page.locator('[data-action="bio-copy"][data-field="mainBio"]').click();
    await page.waitForTimeout(100);
    assert.equal(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
      'My synthetic BIO 🧠'
    );
    await page.locator('[data-view="news"]').click();
    await page.locator('[data-view="generator"]').click();
    assert.equal(await page.locator('#bio-birthplace').inputValue(), 'Manual birthplace');
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'bio-wide.png') });
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 360, height: 720 })
    );
    assert.ok(await page.locator('[data-action="bio-save"]').isVisible());
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    );
    await page.locator('[data-action="bio-save"]').click();
    await page.getByText('BIO сохранено', { exact: true }).waitFor();
    assert.equal(
      (await page.evaluate(() => window.blego.lastCard())).biography.residence,
      residence
    );
    assert.deepEqual((await page.evaluate(() => window.blego.lastCard())).fields, profile.fields);
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'bio-360.png') });
    }
    await app.close();
    app = null;
    page = await launch();
    await page.locator('[data-tab="bio"]').click();
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'My synthetic BIO 🧠');
    assert.equal(await page.locator('#bio-birthplace').inputValue(), 'Manual birthplace');
  }
);
