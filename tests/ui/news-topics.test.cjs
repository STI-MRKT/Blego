const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'News preserves topic, ignores late other-topic replies and retains article metadata with card-only field copies',
  { timeout: 60000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-ui-'));
    // Exercise the preserved explicit opt-out path, independently of fresh-install defaults.
    const initialStore = await require('../../electron/local/store.cjs').openStore(root);
    initialStore.set('tourSeen', true);
    require('../../electron/local/settings.cjs').updateSettings(initialStore, {
      newsEnabled: false
    });
    initialStore.close();
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
    assert.equal(await page.locator('.news-item-card [data-news-copy]').count(), 2);
    assert.equal(await page.locator('.page-head [data-copy-action], #copy-actions').count(), 0);
    assert.equal(
      await page.locator('.news-title').getAttribute('href'),
      'https://example.com/finance'
    );
    assert.match(await page.locator('.news-meta').textContent(), /Test publication/);
    assert.match(await page.locator('.news-meta').textContent(), /Test author/);
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.locator('[name="newsSources"]').count(), 0);
    await app.close();
    app = null;
    // Real persisted snapshot, reopened through the existing SQLite service.
    const { openStore } = require('../../electron/local/store.cjs');
    const { NEWS_SOURCES } = require('../../shared/news-catalog.mjs');
    const source = NEWS_SOURCES.find((s) => s.topic === 'finance');
    const savedAt = '2026-11-01T12:34:56.000Z';
    const store = await openStore(root);
    store.db
      .prepare(
        'INSERT INTO news VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET snapshot=excluded.snapshot'
      )
      .run(
        source.id,
        JSON.stringify({
          sourceUrl: source.url,
          status: 'ok',
          lastSuccessfulAt: savedAt,
          lastAttemptAt: savedAt,
          items: [
            {
              id: 'saved-finance',
              title: 'Saved finance headline',
              source: source.name,
              topic: 'finance',
              link: 'https://example.com/saved-finance',
              publishedAt: Date.parse(savedAt)
            }
          ]
        })
      );
    store.close();
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
    await page.locator('[data-view="news"]').click();
    await page.getByText('Saved finance headline', { exact: true }).waitFor();
    const expectedDate = await page.evaluate((at) => new Date(at).toLocaleString(), savedAt);
    assert.equal(await page.locator('.news-sub').textContent(), `Updated ${expectedDate}`);
  }
);
