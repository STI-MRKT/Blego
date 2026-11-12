const HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'mbasic.facebook.com'
]);
const RESERVED = new Set([
  'groups',
  'posts',
  'reels',
  'videos',
  'watch',
  'marketplace',
  'login',
  'checkpoint',
  'share',
  'help',
  'settings',
  'privacy',
  'policies',
  'pages',
  'events',
  'photo.php',
  'story.php',
  'permalink.php',
  'search',
  'friends',
  'notifications',
  'messages',
  'gaming',
  'recover',
  'reg',
  'dialog'
]);
function numeric(value) {
  return /^\d{1,32}$/.test(value) && /[1-9]/.test(value);
}
function normalizeTarget(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\u0000-\u001f\u007f]/.test(raw))
    throw Error('FB_INPUT_INVALID');
  let value = raw.trim(),
    kind = 'username';
  if (!value) throw Error('FB_INPUT_INVALID');
  if (value.includes('/') || value.includes(':')) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      throw Error('FB_INPUT_INVALID');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw Error('FB_INPUT_INVALID');
    const pathname = url.pathname.replace(/\/$/, '');
    if (pathname === '/profile.php') {
      const ids = url.searchParams.getAll('id');
      if (ids.length !== 1 || !numeric(ids[0])) throw Error('FB_INPUT_INVALID');
      value = ids[0];
      kind = 'id';
    } else {
      const people = pathname.match(/^\/people\/[^/]+\/(\d+)$/);
      value = people ? people[1] : pathname.slice(1);
      if (people && !numeric(value)) throw Error('FB_INPUT_INVALID');
    }
  }
  if (/^\d+$/.test(value)) {
    if (!numeric(value)) throw Error('FB_INPUT_INVALID');
    kind = 'id';
  } else if (!/^[A-Za-z0-9._-]{1,100}$/.test(value) || RESERVED.has(value.toLowerCase()))
    throw Error('FB_INPUT_INVALID');
  if (kind === 'username') value = value.toLowerCase();
  const canonicalUrl =
    kind === 'id'
      ? `https://www.facebook.com/profile.php?id=${value}`
      : `https://www.facebook.com/${value}`;
  return { target: value, kind, canonicalUrl, targetKey: canonicalUrl };
}
function normalizeFacebookTargets(text) {
  if (typeof text !== 'string' || text.length > 410000) throw Error('FB_INPUT_INVALID');
  const lines = text
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, index }))
    .filter((row) => row.raw.trim());
  if (lines.length > 100) throw Error('FB_TOO_MANY_ROWS');
  const targets = [],
    inputRows = [],
    errors = [],
    duplicateMappings = [],
    seen = new Map();
  for (const { raw, index } of lines) {
    try {
      const target = normalizeTarget(raw);
      let targetIndex = seen.get(target.canonicalUrl);
      if (targetIndex === undefined) {
        targetIndex = targets.length;
        seen.set(target.canonicalUrl, targetIndex);
        targets.push(target);
      } else duplicateMappings.push({ inputIndex: index, targetIndex });
      inputRows.push({ inputIndex: index, raw, targetIndex, ...target });
    } catch {
      const error = { inputIndex: index, raw, reasonCode: 'FB_INPUT_INVALID' };
      errors.push(error);
      inputRows.push(error);
    }
  }
  return { targets, inputRows, errors, duplicateMappings };
}
module.exports = { HOSTS, normalizeTarget, normalizeFacebookTargets };
