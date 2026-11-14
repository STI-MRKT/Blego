const { randomUUID } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { FRIENDS } = require('../../../src/js/data/friends.js');
const { isPublicAddress } = require('../../local/network-safety.cjs');
const { normalizeTarget } = require('../facebook/normalize.cjs');
const { fieldForHeader } = require('../../../shared/classifier.mjs');
const secretFields = new Set(['password', 'emailPassword', 'cookies', 'token']);
const MAX_BYTES = 5 * 1024 * 1024,
  MAX_RECORDS = 5000;
const isSecretKey = (key) =>
  secretFields.has(fieldForHeader(String(key).normalize('NFKC'))) ||
  /^(?:authtoken|refreshtoken|idtoken|apikey|clientsecret|session(?:id)?|authorization|twofactorurl|cuser|xs|datr|sb)$/iu.test(
    String(key)
      .normalize('NFKC')
      .trim()
      .replace(/[\s_-]/g, '')
  );
function canonicalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s<>"|\p{Cc}\p{Cf}]/u.test(value))
    throw Error('FRIENDS_INVALID_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error('FRIENDS_INVALID_URL');
  }
  const host = url.hostname
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    (!net.isIP(host) && !host.includes('.')) ||
    host === 'localhost' ||
    /\.(?:localhost|local|internal)$/u.test(host) ||
    (net.isIP(host) && !isPublicAddress(host))
  )
    throw Error('FRIENDS_INVALID_URL');
  for (const key of url.searchParams.keys())
    if (isSecretKey(key)) throw Error('FRIENDS_INVALID_URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^(?:fbclid|igsh|igshid|gclid)$/iu.test(key)) url.searchParams.delete(key);
  if (/^(?:www\.|m\.)?facebook\.com$/u.test(host)) return normalizeTarget(url.href).canonicalUrl;
  if (/^(?:www\.)?instagram\.com$/u.test(host)) {
    if (
      !/^\/[a-z0-9_.]+\/?$/iu.test(url.pathname) ||
      /^\/(?:p|reel|reels|stories|explore)\/?$/iu.test(url.pathname)
    )
      throw Error('FRIENDS_INVALID_URL');
    url.protocol = 'https:';
    url.hostname = 'www.instagram.com';
    url.pathname = url.pathname.replace(/\/$/, '').toLowerCase() + '/';
    url.search = '';
  }
  url.searchParams.sort();
  return url.href;
}
function platformFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return (
    {
      'instagram.com': 'Instagram',
      'facebook.com': 'Facebook',
      'x.com': 'X',
      'twitter.com': 'X',
      'tiktok.com': 'TikTok',
      'youtube.com': 'YouTube'
    }[host] || host
  );
}
const text = (value, limit = 500) => {
  if (value == null) return '';
  if (
    typeof value !== 'string' ||
    value.length > limit ||
    /[\p{Cc}\p{Cf}]/u.test(value.replace(/[\n\r\t]/g, ''))
  )
    throw Error('FRIENDS_INVALID_FIELD');
  return value.trim();
};
function createFriendsService({ store }) {
  const previews = new Map();
  const seed = FRIENDS.map((friend, i) => ({
    ...friend,
    id: `seed-${i}`,
    platform: platformFor(friend.url),
    source: 'Исходный каталог',
    notes: '',
    extraFields: {},
    builtIn: true
  }));
  const saved = () => {
    const rows = store.get('friends:imported') || [];
    if (
      !Array.isArray(rows) ||
      rows.length > MAX_RECORDS ||
      Buffer.byteLength(JSON.stringify(rows)) > 8 * 1024 * 1024
    )
      throw Error('FRIENDS_STORE_INVALID');
    return rows;
  };
  const list = () =>
    structuredClone(
      [...seed, ...saved()].map((row) => {
        let copyUrl = null;
        try {
          copyUrl = canonicalUrl(row.url);
        } catch {
          /* Invalid legacy rows stay visible, not copyable. */
        }
        return { ...row, copyUrl };
      })
    );
  return {
    list,
    async preview({ bytes, name }) {
      if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES)
        throw Error('FRIENDS_INPUT_LIMIT');
      if (
        typeof name !== 'string' ||
        !['txt', 'csv', 'json'].includes(path.extname(name).slice(1).toLowerCase())
      )
        throw Error('FRIENDS_INVALID_FORMAT');
      const { parseInput } = await import('../../../shared/importer.mjs');
      const parsed = await parseInput({ bytes, originalName: path.basename(name) });
      if (parsed.records.length > MAX_RECORDS) throw Error('FRIENDS_INPUT_LIMIT');
      if (parsed.columns.some((key) => isSecretKey(key))) throw Error('FRIENDS_CREDENTIAL_FIELDS');
      const existing = new Set(list().map((row) => canonicalUrl(row.url))),
        accepted = [],
        rows = [];
      let duplicates = 0,
        invalid = 0,
        incomplete = 0;
      for (const record of parsed.records) {
        const data = record.data;
        if (Object.keys(data).some((key) => isSecretKey(key)))
          throw Error('FRIENDS_CREDENTIAL_FIELDS');
        try {
          const url = canonicalUrl(
            text(data.url ?? data.URL ?? data.link ?? data.text ?? data.value, 2048)
          );
          if (existing.has(url)) {
            duplicates++;
            rows.push({ row: record.id, url, status: 'duplicate' });
            continue;
          }
          const extraFields = {};
          for (const [key, value] of Object.entries(data)) {
            if (
              [
                'name',
                'url',
                'URL',
                'link',
                'text',
                'value',
                'platform',
                'geo',
                'topic',
                'niche',
                'source',
                'notes',
                'handle'
              ].includes(key)
            )
              continue;
            if (
              key.length > 100 ||
              Object.keys(extraFields).length >= 20 ||
              ['__proto__', 'constructor', 'prototype'].includes(key)
            )
              throw Error('FRIENDS_INVALID_FIELD');
            extraFields[key] = text(value, 1000);
          }
          const entry = {
            id: randomUUID(),
            name: text(data.name),
            url,
            platform: text(data.platform) || platformFor(url),
            geo: text(data.geo, 100),
            niche: text(data.topic ?? data.niche),
            source: text(data.source) || path.basename(name),
            notes: text(data.notes, 2000),
            handle: text(data.handle, 100),
            extraFields,
            hue: 240,
            builtIn: false
          };
          const partial = !entry.name || !entry.geo || !entry.niche;
          if (partial) incomplete++;
          existing.add(url);
          accepted.push(entry);
          rows.push({ row: record.id, ...entry, status: partial ? 'incomplete' : 'new' });
        } catch (error) {
          invalid++;
          rows.push({
            row: record.id,
            status: 'invalid',
            code:
              error.message === 'FRIENDS_INVALID_URL'
                ? 'FRIENDS_INVALID_URL'
                : 'FRIENDS_INVALID_FIELD'
          });
        }
      }
      if (
        saved().length + accepted.length > MAX_RECORDS ||
        Buffer.byteLength(JSON.stringify([...saved(), ...accepted])) > 8 * 1024 * 1024
      )
        throw Error('FRIENDS_STORE_LIMIT');
      previews.clear();
      const token = randomUUID();
      previews.set(token, accepted);
      return { token, added: accepted.length, duplicates, invalid, incomplete, rows };
    },
    confirm(token) {
      const rows = previews.get(token);
      if (!rows) throw Error('FRIENDS_INVALID_PREVIEW');
      let added = 0;
      store.transaction(() => {
        const current = saved(),
          known = new Set([...seed, ...current].map((row) => canonicalUrl(row.url)));
        const fresh = rows.filter((row) => !known.has(row.url));
        if (
          current.length + fresh.length > MAX_RECORDS ||
          Buffer.byteLength(JSON.stringify([...current, ...fresh])) > 8 * 1024 * 1024
        )
          throw Error('FRIENDS_STORE_LIMIT');
        store.set('friends:imported', [...current, ...fresh]);
        added = fresh.length;
      });
      previews.delete(token);
      return { added, rows: list() };
    },
    cancel(token) {
      return previews.delete(token);
    },
    openUrl(id) {
      const row = list().find((row) => row.id === id);
      if (!row) throw Error('FRIENDS_INVALID_SELECTION');
      return canonicalUrl(row.url);
    }
  };
}
module.exports = { createFriendsService, canonicalUrl };
