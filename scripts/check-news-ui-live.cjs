// Explicit live news acceptance in an isolated app store; no article bodies or user data.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { _electron } = require('playwright'),
  { openStore } = require('../electron/local/store.cjs');
const { updateSettings } = require('../electron/local/settings.cjs');
const { waitForAsync } = require('../tests/fixtures/wait-for-async.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-live-news-ui-')),
    report = { at: new Date().toISOString(), os: process.platform, arch: process.arch, topics: [] };
  let app;
  try {
    const store = await openStore(root);
    store.set('tourSeen', true);
    updateSettings(store, { newsEnabled: true, newsTopic: 'fashion' });
    store.close();
    const executablePath = process.env.BLEGO_EXECUTABLE || undefined;
    app = await _electron.launch({
      executablePath,
      args: [
        ...(process.platform === 'linux' ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(executablePath ? [] : ['.']),
        `--user-data-dir=${root}`
      ]
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="news"]').click();
    await page.locator('[data-action="news-refresh"]').first().waitFor();
    for (const topic of ['fashion', 'ai', 'crypto', 'finance', 'tech']) {
      if ((await page.locator('#news-topic').inputValue()) !== topic)
        await page.locator('#news-topic').selectOption(topic);
      await waitForAsync(
        page,
        async (topic) => {
          const { state } = await import('/js/state.js');
          return state.news.topic === topic && !state.news.loading && !!state.news.lastAttemptAt;
        },
        topic,
        { timeout: 120000 }
      );
      const snapshot = await page.evaluate((topic) => window.blego.newsSnapshot(topic), topic);
      const links = await page
        .locator('.news-item-card .news-title')
        .evaluateAll((els) => els.map((e) => ({ title: e.textContent, link: e.href })));
      assert.equal(links.length, Math.min(40, snapshot.items.length));
      assert.ok(snapshot.items.length >= 10, `${topic} must have at least ten articles in the bundled ten-day seed`);
      const now = Date.now(), cutoff = now - 10 * 24 * 60 * 60 * 1000;
      assert.ok(snapshot.items.every((item) => Number.isFinite(item.publishedAt) && item.publishedAt >= cutoff && item.publishedAt <= now + 60 * 60 * 1000), `${topic} contains an article outside the ten-day window`);
      assert.equal(new Set(links.map((l) => l.link)).size, links.length);
      assert.ok(links.every((l) => l.title.trim() && /^https?:\/\//.test(l.link)));
      report.topics.push({
        topic,
        configured: Object.keys(snapshot.sourceStates).length,
        successful: Object.values(snapshot.sourceStates).filter((s) => s.status === 'ok').length,
        unique: snapshot.items.length,
        displayed: links.length,
        lastSuccessfulAt: snapshot.lastSuccessfulAt,
        status: links.length >= 10 ? 'PASS' : 'BLOCKED',
        links
      });
    }
  } finally {
    if (app) await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
  const out = process.argv[2] || 'release/news-ui-live.json';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      report.topics.map(({ links, ...s }) => s),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
