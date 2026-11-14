const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ10 Friends bulk copy uses GEO/platform/search, all pages, imported rows and real clipboard',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-friends-copy-')),
      data = path.join(root, 'data'),
      input = path.join(root, 'friends.json');
    const store = await openStore(data);
    store.set('tourSeen', true);
    store.close();
    const rows = [
      ...Array.from({ length: 110 }, (_, i) => ({
        name: `US sample ${i}`,
        geo: 'US',
        platform: 'Instagram',
        url: `https://www.instagram.com/qa_us_${i}/`
      })),
      ...Array.from({ length: 7 }, (_, i) => ({
        name: `Canada ${i}`,
        geo: 'CA',
        url: `https://www.instagram.com/qa_ca_${i}/`
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        name: `Australia ${i}`,
        geo: 'AU',
        url: `https://www.instagram.com/qa_au_${i}/`
      })),
      { name: 'US other platform', geo: 'US', url: 'https://x.com/qa_only_x' },
      { geo: 'US', url: 'https://instagram.com/QA_US_0/?utm_source=qa' },
      { geo: 'US', url: 'javascript:alert(1)' }
    ];
    fs.writeFileSync(input, JSON.stringify(rows));
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
    await page.locator('[data-view="friends"]').click();
    assert.equal(await page.locator('[data-friends-copy="seven"]').count(), 1);
    assert.equal(await page.locator('.page-head [data-friends-copy]').count(), 0);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, input);
    await page.locator('[data-action="friends-import"]').click();
    await page.locator('[data-friends-preview]').waitFor();
    await page.locator('[data-action="friends-confirm"]').click();
    await waitForAsync(page, async () => {
      const { state } = await import('/js/state.js');
      return !state.friendsBusy && !state.friendsPreview;
    });
    const seven = page.locator('[data-friends-copy="seven"]'),
      all = page.locator('[data-friends-copy="all"]');
    const read = () => app.evaluate(({ clipboard }) => clipboard.readText());
    async function copy(button) {
      await button.click();
      await waitForAsync(
        page,
        async () => !document.querySelector('[data-friends-copy="all"]').disabled
      );
      return (await read()).split('\n');
    }
    async function geo(value) {
      await page.locator(`[data-action="friends-geo"][data-geo="${value}"]`).click();
    }
    await geo('US');
    await page.locator('#friends-platform').selectOption('Instagram');
    const expected = [
      ...Array.from({ length: 110 }, (_, i) => `https://www.instagram.com/qa_us_${i}/`),
      'https://www.instagram.com/emilycarter/',
      'https://www.instagram.com/noahbennett/',
      'https://www.instagram.com/avabrooks/'
    ];
    const first = await copy(seven);
    assert.equal(first.length, 7);
    assert.equal(new Set(first).size, 7);
    assert.ok(first.every((x) => expected.includes(x)));
    const second = await copy(seven);
    assert.notDeepEqual([...second].sort(), [...first].sort());
    assert.ok(second.every((x) => expected.includes(x)));
    assert.equal(await page.locator('.friend-card').count(), 100);
    await page.locator('[data-action="friends-page"][data-page="1"]').click();
    assert.equal(await page.locator('.friend-card').count(), 13);
    assert.deepEqual((await copy(all)).sort(), expected.sort());
    await page.locator('#friends-query').fill('US sample 10');
    await page.locator('#friends-query').press('Enter');
    const searched = [
      'https://www.instagram.com/qa_us_10/',
      ...Array.from({ length: 10 }, (_, i) => `https://www.instagram.com/qa_us_${100 + i}/`)
    ];
    assert.deepEqual((await copy(all)).sort(), searched.sort());
    // Updating the typed search must update availability even before submitting it.
    await page.locator('#friends-query').fill('nothing matches');
    assert.ok(await seven.isDisabled());
    assert.ok(await all.isDisabled());
    await page.getByText('Нет доступных ссылок', { exact: true }).waitFor();
    await page.locator('#friends-query').fill('');
    await page.locator('#friends-query').press('Enter');
    await page.locator('#friends-platform').selectOption('X');
    assert.ok(await seven.isDisabled());
    assert.deepEqual(await copy(all), ['https://x.com/qa_only_x']);
    await page.locator('#friends-platform').selectOption('');
    await geo('CA');
    assert.ok(await seven.isEnabled());
    assert.equal((await copy(seven)).length, 7);
    await geo('AU');
    assert.ok(await seven.isDisabled());
    assert.deepEqual((await copy(all)).sort(), [
      'https://www.instagram.com/qa_au_0/',
      'https://www.instagram.com/qa_au_1/',
      'https://www.instagram.com/qa_au_2/'
    ]);
    await page.getByText('Скопировано 3 ссылки', { exact: true }).waitFor();
    const preserved = await read();
    await page.waitForTimeout(2600);
    await app.evaluate(({ clipboard }) => {
      globalThis.realCopyWrite = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async () => {
        throw Error('QA_COPY_DENIED');
      };
    });
    await all.click();
    await page.getByText('Не удалось скопировать ссылки', { exact: true }).waitFor();
    assert.equal(await read(), preserved);
    assert.equal(await page.getByText('Скопировано 3 ссылки', { exact: true }).count(), 0);
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = (text) =>
        new Promise((resolve) => {
          globalThis.finishCopy = async () => {
            await globalThis.realCopyWrite(text);
            resolve();
          };
        });
    });
    await all.click();
    await waitForAsync(page, () => document.querySelector('[data-friends-copy="all"]').disabled);
    assert.equal(await page.getByText('Скопировано 3 ссылки', { exact: true }).count(), 0);
    await app.evaluate(async () => {
      await globalThis.finishCopy();
    });
    await page.getByText('Скопировано 3 ссылки', { exact: true }).waitFor();
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = globalThis.realCopyWrite;
    });
    await geo('US');
    await page.locator('#friends-platform').selectOption('Instagram');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.locator('#view').evaluate((view) => {
      view.scrollTop = 0;
    });
    await page.waitForTimeout(2700);
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.BLEGO_CAPTURE, 'tz10-friends-wide.png')
      });
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 360, height: 800 })
    );
    await page.locator('[data-friends-copy="seven"]').scrollIntoViewIfNeeded();
    assert.equal((await copy(seven)).length, 7);
    const bounds = await page.locator('[data-friends-copy="seven"]').boundingBox();
    assert.ok(bounds.width > 0 && bounds.x >= 0 && bounds.x + bounds.width <= 361);
    if (process.env.BLEGO_CAPTURE) {
      await page.waitForTimeout(2700);
      await page.screenshot({
        path: path.join(process.env.BLEGO_CAPTURE, 'tz10-friends-narrow.png')
      });
      fs.writeFileSync(
        path.join(process.env.BLEGO_CAPTURE, 'tz10-friends-clipboard.json'),
        JSON.stringify(
          {
            host: process.platform + '-' + process.arch,
            seven: first,
            repeat: second,
            allCount: 113,
            allPages: true,
            searchCount: 11,
            exactSeven: true,
            three: true,
            empty: true,
            failurePreserved: true,
            awaitedWrite: true
          },
          null,
          2
        )
      );
    }
    assert.equal(await page.locator('.page-head [data-copy-action="open"]').count(), 0);
  }
);
