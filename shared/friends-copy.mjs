// Friends list() supplies copyUrl through its existing canonical URL validator.
// These selections are transient; neither filtering nor copying mutates saved rows.
export function filterFriends(rows, { geo = '', platform = '', query = '' } = {}) {
  const search = query.toLocaleLowerCase();
  return rows.filter(
    (friend) =>
      (!geo || friend.geo === geo) &&
      (!platform || friend.platform === platform) &&
      (!search ||
        [friend.name, friend.url, friend.geo, friend.niche, friend.notes].some((value) =>
          String(value || '')
            .toLocaleLowerCase()
            .includes(search)
        ))
  );
}
export function uniqueFriendLinks(rows) {
  return [
    ...new Set(
      rows.map((row) => row.copyUrl).filter((url) => typeof url === 'string' && url.length > 0)
    )
  ];
}
export function randomBelow(max, fill = (array) => globalThis.crypto.getRandomValues(array)) {
  const limit = Math.floor(0x100000000 / max) * max,
    bytes = new Uint32Array(1);
  for (let attempt = 0; attempt < 128; attempt++) {
    fill(bytes);
    if (bytes[0] < limit) return bytes[0] % max;
  }
  throw Error('FRIENDS_RANDOM_RETRY');
}
export function selectSeven(urls, previous = [], randomInt = randomBelow) {
  if (urls.length < 7) throw Error('FRIENDS_NOT_ENOUGH');
  const old = new Set(previous);
  for (let attempt = 0; attempt < 32; attempt++) {
    const shuffled = [...urls];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, 7);
    if (urls.length === 7 || old.size !== 7 || !selected.every((url) => old.has(url)))
      return selected;
  }
  throw Error('FRIENDS_RANDOM_RETRY');
}
export function friendsCopyMessage(count, seven) {
  if (seven) return '7 ссылок скопировано';
  const last = count % 10,
    hundred = count % 100;
  const noun =
    last === 1 && hundred !== 11
      ? 'ссылка'
      : last >= 2 && last <= 4 && (hundred < 12 || hundred > 14)
        ? 'ссылки'
        : 'ссылок';
  return `Скопировано ${count} ${noun}`;
}
