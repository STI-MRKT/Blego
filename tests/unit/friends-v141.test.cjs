const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ06 incomplete Friends card identifies its real URL while optional name remains empty', async () => {
  const { state } = await import('../../src/js/state.js');
  const { friendsHTML } = await import('../../src/js/ui/friends.js');
  const row = {
    id: 'synthetic',
    name: '',
    url: 'https://example.test/profile',
    geo: '',
    platform: 'Other',
    source: 'Synthetic fixture'
  };
  state.friendsRows = [row];
  const html = friendsHTML(),
    name = /<div class="friend-name">([\s\S]*?)<\/div>/.exec(html)?.[1];
  assert.ok(name.includes('https://example.test/profile'));
  assert.equal(row.name, '');
  assert.ok(html.includes('1 / 1 profiles'));
});
