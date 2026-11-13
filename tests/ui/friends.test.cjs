const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { _electron } = require('playwright');
const { FRIENDS } = require('../../src/js/data/friends.js');
test(
  'Friends preview requires confirmation, preserves cards and supports search/filter/copy/open/restart',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-friends-ui-')),
      input = path.join(root, 'friends.json'),
      data = path.join(root, 'data');
    fs.writeFileSync(
      input,
      JSON.stringify([
        {
          name: 'Synthetic <b>Friend</b>',
          url: 'https://example.org/friends/synthetic',
          geo: 'FR',
          topic: 'Art'
        },
        { url: 'https://example.org/unnamed' }
      ])
    );
    const launch = () =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${data}`
        ]
      });
    let app = await launch();
    t.after(async () => {
      await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    let page = await app.firstWindow();
    await page.locator('[data-view="friends"]').click();
    assert.equal(
      await page.getByRole('button', { name: 'Импортировать Friends', exact: true }).count(),
      1
    );
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, input);
    await page.getByRole('button', { name: 'Импортировать Friends', exact: true }).click();
    await page.locator('[data-friends-preview]').waitFor();
    assert.equal(await page.locator('.friend-card').count(), FRIENDS.length);
    await page.getByRole('button', { name: 'Добавить подтверждённые записи', exact: true }).click();
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.friend-card').length === expected,
      FRIENDS.length + 2
    );
    assert.equal(await page.locator('.friend-name b').count(), 0);
    await page.locator('#friends-query').fill('Synthetic');
    await page.locator('#friends-query').press('Enter');
    assert.equal(await page.locator('.friend-card').count(), 1);
    await page.locator('[data-friend-copy="url"]').click();
    for (let i = 0; i < 40; i++) {
      if (
        (await app.evaluate(({ clipboard }) => clipboard.readText())) ===
        'https://example.org/friends/synthetic'
      )
        break;
      await page.waitForTimeout(25);
    }
    assert.equal(
      await app.evaluate(({ clipboard }) => clipboard.readText()),
      'https://example.org/friends/synthetic'
    );
    await app.evaluate(({ shell }) => {
      globalThis.blegoFriendOpened = [];
      shell.openExternal = async (url) => {
        globalThis.blegoFriendOpened.push(url);
      };
    });
    await page.locator('[data-action="friends-open"]').click();
    await page.waitForTimeout(100);
    assert.deepEqual(await app.evaluate(() => globalThis.blegoFriendOpened), [
      'https://example.org/friends/synthetic'
    ]);
    await page.locator('#friends-platform').selectOption('Instagram');
    assert.equal(await page.locator('.friend-card').count(), 0);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.locator('[data-view="friends"]').click();
    assert.equal(await page.locator('.friend-card').count(), FRIENDS.length + 2);
  }
);
