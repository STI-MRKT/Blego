const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ11 BIO copies six organization values independently, regenerates pairs and restores manual city after native restart',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-bio-pairs-'));
    // This restart scenario starts after onboarding; the first-run tour has its own GUI test.
    const store = await require('../../electron/local/store.cjs').openStore(root);
    store.set('tourSeen', true);
    store.close();
    let app;
    t.after(async () => {
      if (app) await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    const launch = async () => {
      app = await _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${root}`
        ]
      });
      return app.firstWindow();
    };
    let page = await launch();
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-country').selectOption('US');
    await page.locator('#bio-city').fill('New York');
    await page.locator('#bio-type').selectOption('model');
    await page.locator('[data-action="bio-generate"]').click();
    await page.locator('#bio-employerCity').waitFor();
    const record = await page.evaluate(
      async () => (await window.blego.biography({ action: 'read' })).record
    );
    assert.equal(record.values.employer, 'Ralph Lauren Corporation');
    assert.equal(record.values.employerCity, 'New York');
    assert.doesNotMatch(record.values.mainBio, /\./);
    assert.match(record.values.mainBio, /\p{Extended_Pictographic}/u);
    if (process.env.BLEGO_CAPTURE) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setSize(1280, 900)
      );
      await page.locator('#bio-mainBio').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(process.env.BLEGO_CAPTURE, 'tz11-bio-generated.png')
      });
    }
    const copies = {};
    for (const field of [
      'employer',
      'employerCity',
      'university',
      'universityCity',
      'school',
      'schoolCity'
    ]) {
      await page.locator(`[data-action="bio-copy"][data-field="${field}"]`).click();
      for (
        let i = 0;
        i < 50 &&
        (await app.evaluate(({ clipboard }) => clipboard.readText())) !== record.values[field];
        i++
      )
        await page.waitForTimeout(20);
      copies[field] = await app.evaluate(({ clipboard }) => clipboard.readText());
      assert.equal(copies[field], record.values[field]);
      assert.ok(copies[field]);
    }
    const before = { ...record.values };
    await page.locator('[data-action="bio-regenerate"][data-field="university"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.bioEditor.suggesting && !state.bioEditor.dirty;
    });
    const regenerated = await page.evaluate(
      async () => (await window.blego.biography({ action: 'read' })).record
    );
    for (const field of ['employer', 'employerCity', 'school', 'schoolCity', 'mainBio'])
      assert.equal(regenerated.values[field], before[field]);
    assert.equal(regenerated.values.universityCity, regenerated.organizations.university.city);
    await page.locator('#bio-employerCity').fill('Manual city');
    await page.locator('#bio-mainBio').fill('Manual. Exact.');
    await waitForAsync(page, async () => {
      const record = (await window.blego.biography({ action: 'read' })).record;
      return (
        record.values.employerCity === 'Manual city' && record.values.mainBio === 'Manual. Exact.'
      );
    });
    await app.close();
    app = null;
    page = await launch();
    await page.locator('[data-tab="bio"]').click();
    await page.locator('#bio-employerCity').waitFor();
    assert.equal(await page.locator('#bio-employerCity').inputValue(), 'Manual city');
    assert.equal(await page.locator('#bio-mainBio').inputValue(), 'Manual. Exact.');
    if (process.env.BLEGO_CAPTURE) {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setSize(1280, 900)
      );
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz11-bio-pairs.png') });
      fs.writeFileSync(
        path.join(process.env.BLEGO_CAPTURE, 'tz11-bio-clipboard.json'),
        JSON.stringify(
          { platform: process.platform, arch: process.arch, copies, exact: true },
          null,
          2
        )
      );
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 800));
    assert.ok(await page.locator('#bio-employerCity').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.locator('[data-action="bio-save"]').count(), 0);
    assert.equal(await page.locator('.page-head [data-copy-action="open"]').count(), 0);
  }
);
