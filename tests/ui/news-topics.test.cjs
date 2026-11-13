const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'News preserves topic, ignores late other-topic replies and copies each article value',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-ui-'));
    fs.writeFileSync(path.join(root, 'blego-state.json'), JSON.stringify({ tourSeen: true }));
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
    await page.locator('[data-view="news"]').waitFor();
    // Deterministic delayed remote responses; real feed acceptance is separately recorded in stages/03.
    await app.evaluate(({ ipcMain }) => {
      globalThis.newsCalls = [];
      ipcMain.removeHandler('local:newsRefresh');
      ipcMain.handle('local:newsRefresh', async (_e, { topic }) => {
        globalThis.newsCalls.push(topic);
        await new Promise((r) => setTimeout(r, topic === 'fashion' ? 700 : 50));
        return {
          ok: true,
          value: {
            topic,
            items: [
              {
                id: topic,
                title: topic + ' headline',
                source: 'Test publication',
                topic,
                link: 'https://example.com/' + topic,
                publishedAt: 1700000000000,
                author: 'Test author'
              }
            ],
            sourceStates: { test: { status: 'ok' } },
            lastAttemptAt: new Date().toISOString(),
            lastSuccessfulAt: new Date().toISOString()
          }
        };
      });
    });
    assert.deepEqual(await app.evaluate(() => globalThis.newsCalls), []);
    await page.locator('[data-view="news"]').click();
    assert.equal(await page.locator('#news-topic option').count(), 5);
    assert.deepEqual(await app.evaluate(() => globalThis.newsCalls), []);
    await page.getByRole('button', { name: 'Загрузить новости', exact: true }).click();
    await page.locator('#news-topic').selectOption('finance');
    await page.getByText('finance headline', { exact: true }).waitFor();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.news-title').textContent(), 'finance headline');
    for (const [label, value] of [
      ['Copy news title', 'finance headline'],
      ['Copy news link', 'https://example.com/finance'],
      ['Copy news source', 'Test publication'],
      ['Copy article author', 'Test author'],
      ['Copy publication date', new Date(1700000000000).toISOString()]
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      for (let i = 0; i < 50; i++) {
        if ((await app.evaluate(({ clipboard }) => clipboard.readText())) === value) break;
        await page.waitForTimeout(20);
      }
      assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), value);
    }
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.locator('[name="newsSources"]').count(), 0);
    await app.close();
    app = null;
    page = await launch();
    await page.locator('[data-view="news"]').waitFor();
    await waitForAsync(page, async () => {
      const s = await window.blego.getSettings();
      return s.newsTopic === 'finance';
    });
    assert.equal(
      await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return state.news.topic;
      }),
      'finance'
    );
  }
);
