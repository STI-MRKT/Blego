let cache = { items: [], counts: {}, fetchedAt: 0, error: '' };

export async function loadNews(force = false) {
  if (!force && cache.fetchedAt && Date.now() - cache.fetchedAt < 60e3) return cache;
  const response = await fetch(`/api/news${force ? '?force=1' : ''}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('news request failed');
  const data = await response.json();
  cache = {
    items: Array.isArray(data.items) ? data.items : [],
    counts: data.counts || {},
    fetchedAt: Date.now(),
    error: data.error || ''
  };
  return cache;
}
