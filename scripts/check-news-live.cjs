// Explicit network acceptance probe. Uses an isolated temporary database, never user data.
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openStore } = require('../electron/local/store.cjs');
const { updateSettings } = require('../electron/local/settings.cjs');
const { createNewsService } = require('../electron/features/news/service.cjs');
const { fetchFeed, publicFetch } = require('../electron/features/news/feeds.cjs');
const { NEWS_TOPICS, NEWS_SOURCES } = require('../shared/news-catalog.mjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-live-news-')),
    store = await openStore(root),
    responses = [];
  const service = createNewsService({
    store,
    fetcher: (url, signal) =>
      fetchFeed(url, signal, {
        fetchImpl: async (raw, options) => {
          const r = await publicFetch(raw, options);
          responses.push({ url: raw, status: r.status });
          return r;
        }
      })
  });
  const report = {
    at: new Date().toISOString(),
    os: process.platform,
    arch: process.arch,
    node: process.version,
    topics: [],
    responses
  };
  try {
    updateSettings(store, { newsEnabled: true });
    for (const topic of NEWS_TOPICS) {
      const started = performance.now(),
        snapshot = await service.refreshNews({ topic: topic.id, force: true }),
        sources = NEWS_SOURCES.filter((s) => s.topic === topic.id);
      report.topics.push({
        topic: topic.id,
        configured: sources.length,
        successful: Object.values(snapshot.sourceStates).filter((s) => s.status === 'ok').length,
        received: Object.values(snapshot.sourceStates).reduce((n, s) => n + (s.received || 0), 0),
        unique: snapshot.items.length,
        displayed: Math.min(40, snapshot.items.length),
        lastSuccessfulAt: snapshot.lastSuccessfulAt,
        elapsedMs: Math.round(performance.now() - started),
        sources: sources.map((s) => ({ ...s, ...snapshot.sourceStates[s.id] })),
        displayedLinks: snapshot.items
          .slice(0, 40)
          .map((i) => ({ title: i.title, link: i.link, publishedAt: i.publishedAt }))
      });
    }
  } finally {
    service.close();
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
  const output = process.argv[2] || 'release/news-live.json';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      report.topics.map(({ topic, configured, successful, received, unique, displayed }) => ({
        topic,
        configured,
        successful,
        received,
        unique,
        displayed
      })),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
