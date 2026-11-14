const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../../electron/local/store.cjs');
const { updateSettings } = require('../../electron/local/settings.cjs');
const { waitForAsync } = require('../fixtures/wait-for-async.cjs');
test(
  'TZ10 News copies exact title and URL in all topics, refreshed RSS and reopened SQLite cache without navigation',
  { timeout: 90000 },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-news-copy-'));
    let store = await openStore(root);
    store.set('tourSeen', true);
    updateSettings(store, { newsEnabled: false });
    store.close();
    let app;
    const launch = () =>
      _electron.launch({
        executablePath: process.env.BLEGO_EXECUTABLE || undefined,
        args: [
          ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
          ...(process.env.BLEGO_EXECUTABLE ? [] : ['.']),
          `--user-data-dir=${root}`
        ]
      });
    t.after(async () => {
      if (app) await app.close();
      fs.rmSync(root, { recursive: true, force: true });
    });
    app = await launch();
    let page = await app.firstWindow();
    await app.evaluate(async ({ app, ipcMain, shell, BrowserWindow }) => {
      const require = process
        .getBuiltinModule('node:module')
        .createRequire(app.getAppPath() + '/package.json');
      const { validateSender } = require('./electron/local/ipc.cjs');
      const store = await require('./electron/local/store.cjs').openStore(app.getPath('userData'));
      const { NEWS_TOPICS, NEWS_SOURCES } = require('./shared/news-catalog.mjs');
      const catalog = NEWS_TOPICS.map((t) => NEWS_SOURCES.find((s) => s.topic === t.id));
      globalThis.newsRevision = 1;
      globalThis.openedArticles = [];
      globalThis.feedCalls = [];
      shell.openExternal = async (url) => {
        globalThis.openedArticles.push(url);
      };
      const service = require('./electron/features/news/service.cjs').createNewsService({
        store,
        catalog,
        minRefreshMs: 0,
        fetcher: async (url) => {
          const topic = catalog.find((s) => s.url === url).topic;
          globalThis.feedCalls.push(topic);
          const title =
            `${topic} Fashion design Artificial intelligence cryptocurrency finance technology — «QA ${globalThis.newsRevision}» ` +
            'complete headline '.repeat(24) +
            'END_MARKER';
          return `<rss version="2.0"><channel><item><guid>${topic}-${globalThis.newsRevision}</guid><title><![CDATA[${title}]]></title><link>https://example.test/${topic}/${globalThis.newsRevision}?lang=en&amp;edition=qa&amp;item=7&amp;utm_source=rss</link><author>Synthetic author</author></item></channel></rss>`;
        }
      });
      for (const [name, handler] of [
        ['local:newsRefresh', (opts) => service.refreshNews(opts)],
        ['local:newsSnapshot', (topic) => service.snapshot(topic)]
      ]) {
        ipcMain.removeHandler(name);
        ipcMain.handle(name, async (e, value) => {
          const win = BrowserWindow.getAllWindows()[0];
          if (!validateSender(e, win.webContents, win.webContents.getURL()))
            throw Error('UNTRUSTED_IPC');
          return { ok: true, value: await handler(value) };
        });
      }
    });
    await page.locator('[data-view="news"]').click();
    await page.getByRole('button', { name: 'Загрузить новости', exact: true }).click();
    const proof = [];
    async function check(topic, revision) {
      const title =
        `${topic} Fashion design Artificial intelligence cryptocurrency finance technology — «QA ${revision}» ` +
        'complete headline '.repeat(24) +
        'END_MARKER';
      const expectedTitle = title.trim(),
        url = `https://example.test/${topic}/${revision}?edition=qa&item=7&lang=en`;
      await page.getByText(expectedTitle, { exact: true }).waitFor();
      assert.equal(await page.locator('.news-item-card [data-news-copy]').count(), 2);
      assert.equal(await page.locator('.page-head [data-copy-action], #copy-actions').count(), 0);
      const opened = await app.evaluate(() => globalThis.openedArticles.length);
      for (const [kind, expected, message] of [
        ['title', expectedTitle, 'Заголовок скопирован'],
        ['link', url, 'Ссылка скопирована']
      ]) {
        await page.locator(`[data-news-copy="${kind}"]`).click();
        await page.getByText(message, { exact: true }).last().waitFor();
        assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), expected);
      }
      assert.equal(await app.evaluate(() => globalThis.openedArticles.length), opened);
      proof.push({
        topic,
        revision,
        title: expectedTitle,
        url,
        clipboard: 'exact native readback',
        copyDidNotOpenBrowser: true
      });
      return url;
    }
    let url;
    for (const topic of ['fashion', 'ai', 'crypto', 'finance', 'tech']) {
      if (topic !== 'fashion') await page.locator('#news-topic').selectOption(topic);
      url = await check(topic, 1);
    }
    assert.deepEqual(await app.evaluate(() => [...new Set(globalThis.feedCalls)]), [
      'fashion',
      'ai',
      'crypto',
      'finance',
      'tech'
    ]);
    await page.locator('.news-title').click();
    for (let i = 0; i < 40; i++) {
      if ((await app.evaluate(() => globalThis.openedArticles.length)) === 1) break;
      await page.waitForTimeout(25);
    }
    assert.deepEqual(await app.evaluate(() => globalThis.openedArticles), [url]);
    await app.evaluate(() => {
      globalThis.newsRevision = 2;
    });
    await page.locator('[data-action="news-refresh"]').first().click();
    await check('tech', 2);
    await page.waitForTimeout(2700);
    const previous = await app.evaluate(({ clipboard }) => clipboard.readText());
    await app.evaluate(({ clipboard }) => {
      globalThis.realNewsWrite = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async () => {
        throw Error('QA_COPY_DENIED');
      };
    });
    await page.locator('[data-news-copy="title"]').click();
    await page.locator('.toast').last().waitFor();
    assert.equal(await page.getByText('Заголовок скопирован', { exact: true }).count(), 0);
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), previous);
    assert.match(
      await page.locator('.toast').last().textContent(),
      /Copy failed|Не удалось скопировать/
    );
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText = globalThis.realNewsWrite;
    });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 })
    );
    await page.waitForTimeout(2700);
    if (process.env.BLEGO_CAPTURE) {
      fs.mkdirSync(process.env.BLEGO_CAPTURE, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz10-news-wide.png') });
    }
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ width: 360, height: 800 })
    );
    await check('tech', 2);
    for (const kind of ['title', 'link']) {
      const b = await page.locator(`[data-news-copy="${kind}"]`).boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= 361);
    }
    if (process.env.BLEGO_CAPTURE) {
      await page.waitForTimeout(2700);
      await page.screenshot({ path: path.join(process.env.BLEGO_CAPTURE, 'tz10-news-narrow.png') });
    }
    await app.close();
    app = null;
    store = await openStore(root);
    updateSettings(store, { newsEnabled: false });
    store.close();
    app = await launch();
    page = await app.firstWindow();
    await app.evaluate(({ shell }) => {
      globalThis.openedArticles = [];
      shell.openExternal = async (url) => {
        globalThis.openedArticles.push(url);
      };
    });
    await page.locator('[data-view="news"]').click();
    await check('tech', 2);
    if (process.env.BLEGO_CAPTURE)
      fs.writeFileSync(
        path.join(process.env.BLEGO_CAPTURE, 'tz10-news-clipboard.json'),
        JSON.stringify(
          {
            host: process.platform + '-' + process.arch,
            proof,
            cacheAfterRestart: true,
            copyFailurePreservedClipboard: true,
            titleOpensBrowser: true,
            topics: 5,
            source: 'controlled RSS transport; actual parser,SQLite,renderer and native clipboard'
          },
          null,
          2
        )
      );
  }
);
