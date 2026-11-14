const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { createFriendsService } = require('../../electron/features/friends/service.cjs');
test('Friends copy eligibility reuses canonical URL validation without rewriting persisted rows', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-copy-eligibility-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const rows = [
    { id: 'one', geo: 'US', url: 'https://instagram.com/EXAMPLE/?utm_source=qa#bio' },
    { id: 'two', geo: 'US', url: 'https://www.instagram.com/example/' },
    { id: 'invalid', geo: 'US', url: 'javascript:alert(1)' },
    { id: 'query', geo: 'US', url: 'https://example.test/profile?b=2&a=1&utm_campaign=qa' },
    { id: 'secret', geo: 'US', url: 'https://example.test/?token=synthetic' },
    { id: 'local', geo: 'US', url: 'http://127.0.0.1/profile' }
  ];
  store.set('friends:imported', rows);
  const listed = createFriendsService({ store })
    .list()
    .filter((r) => rows.some((old) => old.id === r.id));
  assert.deepEqual(
    listed.map((r) => r.copyUrl),
    [
      'https://www.instagram.com/example/',
      'https://www.instagram.com/example/',
      null,
      'https://example.test/profile?a=1&b=2',
      null,
      null
    ]
  );
  assert.deepEqual(store.get('friends:imported'), rows);
});
