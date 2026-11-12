const { getSettings } = require('../../local/settings.cjs');
const { parseFeed, fetchFeed } = require('./feeds.cjs');
function createNewsService({
  store,
  fetcher = fetchFeed,
  clock = () => new Date(),
  setTimer = setInterval,
  clearTimer = clearInterval,
  onUpdate = () => {}
}) {
  let timer = null,
    controller = null,
    active = null;
  function snapshot() {
    const selected = new Set(getSettings(store).newsSources.map((s) => s.id));
    const cached = store.db
      .prepare('SELECT source_id,snapshot FROM news')
      .all()
      .filter((r) => selected.has(r.source_id))
      .map((r) => [r.source_id, JSON.parse(r.snapshot)]);
    const sourceStates = Object.fromEntries(
      cached.map(([id, c]) => [
        id,
        {
          status: c.status,
          stale: c.stale,
          lastSuccessfulAt: c.lastSuccessfulAt,
          lastAttemptAt: c.lastAttemptAt,
          code: c.code
        }
      ])
    );
    const seen = new Set();
    const items = cached
      .flatMap(([, c]) => c.items.map((i) => ({ ...i, stale: c.stale })))
      .filter((i) => {
        if (seen.has(i.link)) return false;
        seen.add(i.link);
        return true;
      })
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    const counts = {};
    for (const i of items) counts[i.topic] = (counts[i.topic] || 0) + 1;
    const max = (field) =>
      cached
        .map(([, c]) => c[field])
        .filter(Boolean)
        .sort()
        .at(-1) || null;
    return {
      items,
      counts,
      sourceStates,
      lastSuccessfulAt: max('lastSuccessfulAt'),
      lastAttemptAt: max('lastAttemptAt')
    };
  }
  async function refreshNews(options = {}) {
    const settings = getSettings(store);
    if (!settings.newsEnabled || !settings.newsSources.length) return snapshot();
    if (active) return active;
    const c = new AbortController();
    controller = c;
    active = (async () => {
      const sources = settings.newsSources.filter(
        (s) => !options.sourceIds || options.sourceIds.includes(s.id)
      );
      let next = 0;
      async function work() {
        while (next < sources.length && !c.signal.aborted) {
          const source = sources[next++];
          const old = store.db
            .prepare('SELECT snapshot FROM news WHERE source_id=?')
            .get(source.id);
          const previous = old ? JSON.parse(old.snapshot) : { items: [], lastSuccessfulAt: null };
          if (
            !options.force &&
            previous.lastAttemptAt &&
            clock() - new Date(previous.lastAttemptAt) < settings.newsInterval * 60000
          )
            continue;
          const at = clock().toISOString();
          let current;
          try {
            const xml = await fetcher(source.url, c.signal);
            c.signal.throwIfAborted();
            current = {
              sourceUrl: source.url,
              items: parseFeed(xml, source),
              status: 'ok',
              stale: false,
              lastAttemptAt: at,
              lastSuccessfulAt: at
            };
          } catch (e) {
            if (c.signal.aborted) continue;
            current = {
              ...previous,
              status: e.message === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable',
              stale: true,
              lastAttemptAt: at,
              code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED'
            };
          }
          if (!c.signal.aborted)
            store.db
              .prepare(
                'INSERT INTO news VALUES(?,?) ON CONFLICT(source_id) DO UPDATE SET snapshot=excluded.snapshot'
              )
              .run(source.id, JSON.stringify(current));
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, sources.length) }, work));
      const result = snapshot();
      onUpdate(result);
      return result;
    })();
    try {
      return await active;
    } finally {
      if (controller === c) controller = null;
      active = null;
    }
  }
  function configure() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    controller?.abort();
    const s = getSettings(store);
    if (s.newsEnabled && s.newsSources.length) {
      timer = setTimer(() => {
        refreshNews().catch(() => {});
      }, s.newsInterval * 60000);
      timer?.unref?.();
    }
  }
  function close() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    controller?.abort();
  }
  return {
    refreshNews,
    snapshot,
    configure,
    close,
    cancel() {
      controller?.abort();
      return true;
    }
  };
}
module.exports = { createNewsService };
