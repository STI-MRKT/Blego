export function parseIds(text) {
  const tokens = String(text).split(/[\s,;|]+/).filter(Boolean);
  const seen = new Set();
  const rows = [];
  for (const raw of tokens) {
    const value = raw.replace(/^[<("']+|[>)"']+$/g, '');
    let id = value;
    const profile = value.match(/profile\.php\?id=(\d{5,20})/i);
    const path = value.match(/facebook\.com\/(?:profile\.php\?id=(\d{5,20})|([a-z0-9._-]{3,50}))/i);
    if (profile) id = profile[1];
    else if (path) id = path[1] || path[2];
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (/^\d{5,20}$/.test(id)) {
      rows.push({ id, type: 'numeric', status: 'Valid ID', link: `https://www.facebook.com/${id}` });
    } else if (/^[a-z0-9._-]{3,50}$/i.test(id)) {
      rows.push({ id, type: 'vanity', status: 'Vanity handle', link: `https://www.facebook.com/${id}` });
    } else {
      rows.push({ id: value, type: 'invalid', status: 'Invalid format', link: '' });
    }
  }
  return rows;
}

async function checkProfile(id) {
  const response = await fetch(`/api/fb/check?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({ error: 'Bad response' }));
  if (data.error) throw new Error(data.error);
  return data;
}

export async function checkProfiles(ids, onProgress) {
  const queue = [...ids];
  const total = queue.length;
  const results = new Map();
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      let result;
      try {
        result = await checkProfile(id);
      } catch (error) {
        result = { id, status: 'unreachable', error: error.message || 'Request failed' };
      }
      results.set(id, result);
      done += 1;
      onProgress?.(done, total, result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, total) }, worker));
  return results;
}
