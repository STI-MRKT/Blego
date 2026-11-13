const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { openStore } = require('../../electron/local/store.cjs');
const { FRIENDS } = require('../../src/js/data/friends.js');
async function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-friends-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    async reopen() {
      store.close();
      store = await openStore(root);
    }
  };
}
test('Friends explicit preview/confirm preserves seed cards, canonical dedup, optional blanks and restart', async (t) => {
  const { createFriendsService } = require('../../electron/features/friends/service.cjs');
  const env = await setup(t);
  let service = createFriendsService({ store: env.store });
  const preview = await service.preview({
    bytes: Buffer.from(
      JSON.stringify([
        {
          name: 'Synthetic <b>Fixture</b>',
          url: 'https://instagram.com/synthetic_fixture_v14/?utm_source=test',
          geo: 'FR',
          topic: 'Art',
          notes: 'Local notes'
        },
        { url: 'https://www.instagram.com/SYNTHETIC_FIXTURE_V14/' },
        { url: FRIENDS[0].url },
        { url: 'https://example.org/profile/second' }
      ])
    ),
    name: 'synthetic.json'
  });
  assert.equal(preview.added, 2);
  assert.equal(preview.duplicates, 2);
  assert.equal(preview.incomplete, 1);
  assert.equal(service.list().length, FRIENDS.length);
  assert.equal(env.store.get('friends:imported'), undefined);
  const result = service.confirm(preview.token);
  assert.equal(result.added, 2);
  assert.throws(() => service.confirm(preview.token), /FRIENDS_INVALID_PREVIEW/);
  await env.reopen();
  service = createFriendsService({ store: env.store });
  const rows = service.list();
  assert.equal(rows.length, FRIENDS.length + 2);
  for (let i = 0; i < FRIENDS.length; i++)
    for (const key of Object.keys(FRIENDS[i])) assert.deepEqual(rows[i][key], FRIENDS[i][key]);
  assert.equal(rows.at(-1).name, '');
  assert.equal(rows.at(-1).geo, '');
  assert.equal(rows.at(-1).niche, '');
  assert.equal(rows.at(-2).name, 'Synthetic <b>Fixture</b>');
  assert.equal(rows.at(-2).notes, 'Local notes');
  assert.equal(rows.at(-2).source, 'synthetic.json');
});
test('Friends TXT/CSV reuse existing parser; hostile links and credential-bearing input cannot become saved profiles', async (t) => {
  const { createFriendsService } = require('../../electron/features/friends/service.cjs');
  const env = await setup(t),
    service = createFriendsService({ store: env.store });
  const text = await service.preview({
    bytes: Buffer.from('https://example.org/one\nhttps://example.org/two\n'),
    name: 'links.txt'
  });
  assert.equal(text.added, 2);
  service.confirm(text.token);
  const csv = await service.preview({
    bytes: Buffer.from(
      'name,url,geo,topic\n"Synthetic, Person",https://example.org/three,PL,Art\n'
    ),
    name: 'links.csv'
  });
  assert.equal(csv.added, 1);
  service.confirm(csv.token);
  assert.equal(service.list().at(-1).name, 'Synthetic, Person');
  const invalid = [
    'javascript:alert(1)',
    'file:///tmp/private',
    'http://localhost/a',
    'https://127.0.0.1/a',
    'https://[::ffff:127.0.0.1]/a',
    'https://user:secret@example.org/',
    'https://example.org/?access_token=synthetic',
    'https://example.org/a|synthetic-password'
  ];
  const bad = await service.preview({ bytes: Buffer.from(invalid.join('\n')), name: 'bad.txt' });
  assert.equal(bad.added, 0);
  assert.equal(bad.invalid, invalid.length);
  await assert.rejects(
    service.preview({
      bytes: Buffer.from('[{"url":"https://example.org/p","cookies":"synthetic"}]'),
      name: 'auth.json'
    }),
    /FRIENDS_CREDENTIAL_FIELDS/
  );
  await assert.rejects(
    service.preview({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1), name: 'large.txt' }),
    /FRIENDS_INPUT_LIMIT/
  );
  assert.equal(service.list().length, FRIENDS.length + 3);
});

test('credential column whitespace and Unicode normalization cannot hide secrets in Friends extras', async (t) => {
  const { createFriendsService } = require('../../electron/features/friends/service.cjs');
  const env = await setup(t),
    service = createFriendsService({ store: env.store });
  for (const key of [' password ', 'ＰＡＳＳＷＯＲＤ', 'email_password', 'sessionid'])
    await assert.rejects(
      service.preview({
        bytes: Buffer.from(
          JSON.stringify([{ url: 'https://example.org/p', [key]: 'synthetic-only' }])
        ),
        name: 'credentials.json'
      }),
      /FRIENDS_CREDENTIAL_FIELDS/
    );
  assert.equal(env.store.get('friends:imported'), undefined);
});

test('Friends rejects classifier credential aliases in JSON/CSV and explicit URL query keys', async (t) => {
  const { createFriendsService } = require('../../electron/features/friends/service.cjs');
  const env = await setup(t),
    service = createFriendsService({ store: env.store });
  for (const key of [
    'cookiesJson',
    'cookie_json',
    'куки',
    'пароль',
    'пароль от почты',
    'токен',
    'auth_token'
  ]) {
    await assert.rejects(
      service.preview({
        bytes: Buffer.from(
          JSON.stringify([{ url: 'https://example.test/p', [key]: 'FAKE_CREDENTIAL' }])
        ),
        name: 'auth.json'
      }),
      /FRIENDS_CREDENTIAL_FIELDS/
    );
    await assert.rejects(
      service.preview({
        bytes: Buffer.from(`url,${key}\nhttps://example.test/p,FAKE_CREDENTIAL`),
        name: 'auth.csv'
      }),
      /FRIENDS_CREDENTIAL_FIELDS/
    );
    const query = await service.preview({
      bytes: Buffer.from(`https://example.test/p?${encodeURIComponent(key)}=FAKE_CREDENTIAL`),
      name: 'links.txt'
    });
    assert.equal(query.added, 0);
    assert.equal(query.invalid, 1);
  }
  assert.equal(env.store.get('friends:imported'), undefined);
});
