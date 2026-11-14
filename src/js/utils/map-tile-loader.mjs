// A component owns only its visible requests. Decoded tiles and attempt budgets
// may survive remounts; no request is made until update receives visible tiles.
export function createMapTileLoader({ load, cancel, decode, onChange, cache = new Map(), attempts = new Map(), retryDelay = 350, timeoutMs = 10000 }) {
  let wanted = new Map(), closed = false, timer;
  const pending = new Map();
  const keyOf = (t) => `${t.z}/${t.x}/${t.y}`;
  const notify = () => { if (!closed) onChange(); };
  function stop(key, job) {
    pending.delete(key);
    clearTimeout(job.timer);
    job.abort();
    Promise.resolve(cancel(job.id)).catch(() => {});
  }
  function pump() {
    clearTimeout(timer);
    if (closed) return;
    let next = Infinity;
    for (const [key, tile] of wanted) {
      if (cache.has(key) || pending.has(key)) continue;
      const state = attempts.get(key) || { count: 0, at: 0 };
      if (state.count >= 3) continue;
      if (state.at > Date.now()) { next = Math.min(next, state.at - Date.now()); continue; }
      if (pending.size >= 4) break;
      const job = { id: crypto.randomUUID() };
      pending.set(key, job);
      const cancelled = new Promise((_, reject) => { job.abort = () => reject(Error('CANCELLED')); });
      const timeout = new Promise((_, reject) => { job.timer = setTimeout(() => { Promise.resolve(cancel(job.id)).catch(() => {}); reject(Error('TIMEOUT')); }, timeoutMs); });
      Promise.race([Promise.resolve().then(() => { if (closed || pending.get(key) !== job) throw Error('CANCELLED'); return load({ z: tile.z, x: tile.x, y: tile.y, requestId: job.id }); }).then(decode), cancelled, timeout]).then((image) => {
        if (closed || pending.get(key) !== job || !wanted.has(key)) return;
        cache.set(key, image); attempts.delete(key);
        if (cache.size > 128) cache.delete(cache.keys().next().value);
      }).catch((error) => {
        if (closed || pending.get(key) !== job || error.message === 'CANCELLED') return;
        attempts.set(key, { count: state.count + 1, at: Date.now() + retryDelay * (state.count + 1) });
        if (attempts.size > 256) attempts.delete(attempts.keys().next().value);
      }).finally(() => {
        clearTimeout(job.timer);
        if (pending.get(key) === job) pending.delete(key);
        notify(); pump();
      });
    }
    if (Number.isFinite(next)) timer = setTimeout(pump, next);
  }
  return {
    update(tiles) {
      wanted = new Map(tiles.map((tile) => [keyOf(tile), tile]));
      for (const [key, job] of pending) if (!wanted.has(key)) stop(key, job);
      pump();
    },
    snapshot() {
      const keys = [...wanted.keys()];
      return { total: keys.length, ready: keys.filter((key) => cache.has(key)).length, failed: keys.filter((key) => !cache.has(key) && attempts.get(key)?.count >= 3).length };
    },
    retry() { for (const key of wanted.keys()) attempts.delete(key); pump(); },
    dispose() { closed = true; clearTimeout(timer); for (const [key, job] of pending) stop(key, job); }
  };
}
