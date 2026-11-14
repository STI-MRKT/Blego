const { test } = require('node:test');
const assert = require('node:assert/strict');
test('Friends renders disabled seven below seven and no-links feedback without a header Copy', async () => {
  const { state } = await import('../../src/js/state.js');
  const { friendsHTML } = await import('../../src/js/ui/friends.js');
  state.friendsGeo = 'US';
  state.friendsPlatform = '';
  state.friendsQuery = '';
  state.friendsRows = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    geo: 'US',
    url: `https://example.test/${i}`,
    copyUrl: `https://example.test/${i}`
  }));
  let html = friendsHTML();
  assert.match(html, /data-friends-copy="seven"[^>]*disabled/);
  assert.ok(!/data-friends-copy="all"[^>]*disabled/.test(html));
  state.friendsGeo = 'ZZ';
  html = friendsHTML();
  assert.match(html, /data-friends-copy="all"[^>]*disabled/);
  assert.ok(html.includes('Нет доступных ссылок'));
});
test('Friends copies complete filtered unique canonical URLs rather than visible page or other GEO', async () => {
  const { filterFriends, uniqueFriendLinks } = await import('../../shared/friends-copy.mjs');
  const rows = [
    { geo: 'US', platform: 'Instagram', name: 'Keep', copyUrl: 'https://www.instagram.com/a/' },
    {
      geo: 'US',
      platform: 'Instagram',
      name: 'Keep duplicate',
      copyUrl: 'https://www.instagram.com/a/'
    },
    { geo: 'US', platform: 'Instagram', name: 'Keep invalid', copyUrl: null },
    { geo: 'BR', platform: 'Instagram', name: 'Keep', copyUrl: 'https://example.test/b' },
    { geo: 'US', platform: 'X', name: 'Keep', copyUrl: 'https://example.test/c' },
    { geo: 'US', platform: 'Instagram', name: 'Other', copyUrl: 'https://example.test/d' }
  ];
  assert.deepEqual(
    uniqueFriendLinks(filterFriends(rows, { geo: 'US', platform: 'Instagram', query: 'keep' })),
    ['https://www.instagram.com/a/']
  );
  const many = Array.from({ length: 125 }, (_, i) => ({
    geo: 'US',
    copyUrl: `https://example.test/${i}`
  }));
  assert.equal(uniqueFriendLinks(filterFriends(many, { geo: 'US' })).length, 125);
});
test('seven sampling is uniform over all eight-profile permutations, immutable, and not first seven', async () => {
  const { selectSeven } = await import('../../shared/friends-copy.mjs');
  const pool = Array.from({ length: 8 }, (_, i) => String(i)),
    counts = new Map();
  function visit(choices, max) {
    if (max < 2) {
      let pos = 0;
      const result = selectSeven(pool, [], () => choices[pos++]);
      assert.equal(new Set(result).size, 7);
      const omitted = pool.find((x) => !result.includes(x));
      counts.set(omitted, (counts.get(omitted) || 0) + 1);
      return;
    }
    for (let j = 0; j < max; j++) visit([...choices, j], max - 1);
  }
  visit([], 8);
  assert.deepEqual([...counts.values()], Array(8).fill(5040));
  assert.deepEqual(pool, ['0', '1', '2', '3', '4', '5', '6', '7']);
});
test('seven selection rejects a repeated set, permits exactly seven, and bounds broken RNG retries', async () => {
  const { selectSeven, randomBelow } = await import('../../shared/friends-copy.mjs');
  const pool = Array.from({ length: 8 }, (_, i) => String(i)),
    previous = pool.slice(0, 7);
  let calls = 0;
  const next = selectSeven(pool, previous, (max) => (++calls <= 7 ? max - 1 : 0));
  assert.ok(next.includes('7'));
  assert.ok(calls > 7);
  assert.deepEqual(
    selectSeven(previous, previous, (max) => max - 1),
    previous
  );
  assert.throws(() => selectSeven(pool, previous, (max) => max - 1), /FRIENDS_RANDOM_RETRY/);
  assert.throws(() => selectSeven(pool.slice(0, 3)), /FRIENDS_NOT_ENOUGH/);
  const values = [4294967295, 5];
  let reads = 0;
  assert.equal(
    randomBelow(7, (a) => {
      a[0] = values[reads++];
      return a;
    }),
    5
  );
  assert.equal(reads, 2);
});
