const { getSettings } = require('../../local/settings.cjs');
const { parseFeed, fetchFeed, normalizeLink } = require('./feeds.cjs');
const { NEWS_SOURCES, newsTopic } = require('../../../shared/news-catalog.mjs');
function createNewsService({
  store,
  fetcher = fetchFeed,
  catalog = NEWS_SOURCES,
  clock = () => new Date(),
  minRefreshMs = 30000,
  onUpdate = () => {}
}) {
  const active = new Map();
  let workers = 0;
  const waiting = [];
  async function slot(fn) {
    if (workers >= 4) await new Promise((resolve) => waiting.push(resolve));
    else workers++;
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else workers--;
    }
  }
  const topicOf = (value) => newsTopic(value ?? getSettings(store).newsTopic);
  const sourcesFor = (topic) => catalog.filter((s) => (s.topic || 'fashion') === topic);
  function snapshot(requested) {
    const topic = topicOf(requested),
      sources = sourcesFor(topic);
    const cached = sources.map((source) => {
      const row = store.db.prepare('SELECT snapshot FROM news WHERE source_id=?').get(source.id);
      const data = row ? JSON.parse(row.snapshot) : null;
      return [
        source.id,
        data?.sourceUrl === source.url ? data : { items: [], status: 'not_loaded' }
      ];
    });
    const sourceStates = Object.fromEntries(
      cached.map(([id, c]) => [
        id,
        {
          status: c.status,
          stale: !!c.stale,
          lastSuccessfulAt: c.lastSuccessfulAt || null,
          lastAttemptAt: c.lastAttemptAt || null,
          code: c.code || null,
          received: c.received || 0
        }
      ])
    );
    const seen = new Set();
    const items = cached
      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: !!c.stale })))
      .filter((i) => {
        const link = normalizeLink(i.link);
        if (!link || seen.has(link) || seen.has(i.id)) return false;
        seen.add(link);
        seen.add(i.id);
        i.link = link;
        return true;
      })
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const max = (field) =>
      cached
        .map(([, c]) => c[field])
        .filter(Boolean)
        .sort()
        .at(-1) || null;
    return {
      topic,
      items,
      counts: { [topic]: items.length },
      sourceStates,
      lastSuccessfulAt: max('lastSuccessfulAt'),
      lastAttemptAt: max('lastAttemptAt')
    };
  }
  async function refreshNews(options = {}) {
    const settings = getSettings(store),
      topic = topicOf(options.topic);
    if (!settings.newsEnabled) return snapshot(topic);
    if (active.has(topic)) return active.get(topic).promise;
    const controller = new AbortController(),
      entry = { controller };
    active.set(topic, entry);
    entry.promise = (async () => {
      const sources = sourcesFor(topic);
      await Promise.all(
        sources.map((source) =>
          slot(async () => {
            if (controller.signal.aborted) return;
            const row = store.db
              .prepare('SELECT snapshot FROM news WHERE source_id=?')
              .get(source.id);
            let previous = row ? JSON.parse(row.snapshot) : { items: [], lastSuccessfulAt: null };
            if (previous.sourceUrl && previous.sourceUrl !== source.url)
              previous = { items: [], lastSuccessfulAt: null };
            const age = clock() - new Date(previous.lastAttemptAt || 0);
            if (
              previous.lastAttemptAt &&
              age < (options.force ? minRefreshMs : settings.newsInterval * 60000)
            )
              return;
            const at = clock().toISOString();
            let current;
            try {
              const xml = await fetcher(source.url, controller.signal);
              controller.signal.throwIfAborted();
              const parsed = parseFeed(xml, source);
              const items = parsed.filter(
                (i) =>
                  !i.publishedAt ||
                  (i.publishedAt <= +clock() + 3600000 && i.publishedAt >= +clock() - 30 * 86400000)
              );
              if (!items.length) throw Error('EMPTY_FEED');
              current = {
                sourceUrl: source.url,
                items,
                received: parseFeed(xml, source, { relevance: false }).length,
                status: 'ok',
                stale: false,
                lastAttemptAt: at,
                lastSuccessfulAt: at
              };
            } catch (e) {
              if (controller.signal.aborted) return;
              current = {
                ...previous,
                sourceUrl: source.url,
                status: e.message === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable',
                stale: true,
                lastAttemptAt: at,
                code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED'
              };
            }
            if (!controller.signal.aborted)
              store.db
                .prepare(
                  'INSERT INTO news VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET snapshot=excluded.snapshot'
                )
                .run(source.id, JSON.stringify(current));
          })
        )
      );
      const result = snapshot(topic);
      if (controller.signal.aborted) result.cancelled = true;
      else onUpdate(result);
      return result;
    })();
    try {
      return await entry.promise;
    } finally {
      if (active.get(topic) === entry) active.delete(topic);
    }
  }
  function cancel() {
    for (const entry of active.values()) entry.controller.abort();
    return true;
  }
  return {
    refreshNews,
    snapshot,
    cancel,
    close: cancel,
    configure() {
      if (!getSettings(store).newsEnabled) cancel();
    }
  };
}
module.exports = { createNewsService };
