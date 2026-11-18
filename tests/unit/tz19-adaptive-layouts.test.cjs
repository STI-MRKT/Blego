const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');

const uid = '61500000123456';
const cookie = JSON.stringify([
  { name: 'c_user', value: uid },
  { name: 'xs', value: 'SYNTHETIC_COOKIE' }
]);
const layoutA = {
  version: 1,
  roles: ['login', 'password', 'email', 'accountId', 'cookies'],
  anchors: [null, null, 'email', 'accountId', 'cookies']
};
const layoutB = {
  version: 1,
  roles: ['accountId', 'email', 'login', 'password'],
  anchors: ['accountId', 'email', null, null]
};
async function scan(text, opts = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic.txt' },
    { classification: true, headers: false, ...opts }
  );
  return { parsed, records: classifyRecords(parsed, opts).records };
}

test('TZ19 existing good labelled records remain unchanged with or without learned layouts', async () => {
  const text = [
    'ID:' + uid,
    'Email:one@example.test',
    'Password:EXAMPLE_FB_1',
    'Email Password:EXAMPLE_MAIL_2',
    'Date of Birth:1998-11-18'
  ].join('|');
  const before = await scan(text);
  const after = await scan(text, { learnedLayouts: [layoutA, layoutB] });
  assert.deepEqual(
    after.records.map((r) => ({ data: r.data, extended: r.extended })),
    before.records.map((r) => ({ data: r.data, extended: r.extended }))
  );
  assert.equal(after.records[0].data.password, 'EXAMPLE_FB_1');
  assert.equal(after.records[0].data.emailPassword, 'EXAMPLE_MAIL_2');
});

test('TZ19 confirmed layout classifies unresolved bare rows locally, independent of position in file', async () => {
  const a = ['synthetic.login', 'SYNTHETIC_PASS_1', 'one@example.test', uid, cookie].join('|');
  const b = [uid, 'two@example.test', 'other.login', 'SYNTHETIC_PASS_2'].join('|');
  const { records } = await scan(a + '\n' + b, { learnedLayouts: [layoutA, layoutB] });
  assert.equal(records.length, 2);
  assert.equal(records[0].data.password, 'SYNTHETIC_PASS_1');
  assert.equal(records[0].extended.login, 'synthetic.login');
  assert.equal(records[0].data.cookies, cookie);
  assert.equal(records[1].data.password, 'SYNTHETIC_PASS_2');
  assert.equal(records[1].extended.login, 'other.login');
  assert.equal(records[1].data.accountId, uid);
  assert.equal(records[0].sourceRecord, a);
  assert.equal(records[1].sourceRecord, b);
});

test('TZ19 missing optional cookie can be omitted without shifting other columns', async () => {
  const row = ['synthetic.login', 'SYNTHETIC_PASS_1', 'one@example.test', uid].join('|');
  const { records } = await scan(row, { learnedLayouts: [layoutA] });
  assert.equal(records.length, 1);
  assert.equal(records[0].data.password, 'SYNTHETIC_PASS_1');
  assert.equal(records[0].data.cookies, '');
  assert.equal(records[0].data.accountId, uid);
  assert.equal(records[0].extended.login, 'synthetic.login');
});

test('TZ19 contradictory or ambiguous template matches never guess a password', async () => {
  const row = [uid, 'two@example.test', 'other.login', 'SYNTHETIC_PASS_2'].join('|');
  const opposed = { ...layoutB, roles: ['accountId', 'email', 'password', 'login'] };
  const { records } = await scan(row, { learnedLayouts: [layoutB, opposed] });
  assert.equal(records[0].data.password, '');
  assert.ok(records[0].unrecognized.some((field) => field.value === 'SYNTHETIC_PASS_2'));

  const oneAnchor = ['synthetic.login', 'SYNTHETIC_PASS_1', uid, 'SYNTHETIC_RANDOM'].join('|');
  const template = {
    version: 1,
    roles: ['login', 'password', 'accountId', null],
    anchors: [null, null, 'accountId', null]
  };
  const weak = await scan(oneAnchor, { learnedLayouts: [template] });
  assert.equal(weak.records[0].data.password, '');
});

test('TZ19 saved patterns are explicit, survive service restart, and contain no credential values', async () => {
  const values = new Map();
  const store = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value)
  };
  const input = (line) => ({
    requestId: randomUUID(),
    originalName: 'synthetic.txt',
    bytes: Buffer.from(line)
  });
  const line = ['synthetic.login', 'SYNTHETIC_PASS_1', 'one@example.test', uid, cookie].join('|');
  const next = [
    'next.login',
    'NEXT_PASS_ONLY',
    'next@example.test',
    '61500000123457',
    JSON.stringify([{ name: 'c_user', value: '61500000123457' }])
  ].join('|');
  const service = createClassificationService({ getStore: () => store });
  try {
    const first = await service.read(input(line), {
      headers: false,
      columnOrder: 'Логин|Пароль|Email|Fb_ID|Cookie'
    });
    assert.equal(service.savedLayouts().length, 0, 'read-only inference never trains itself');
    await service.reclassify(first.operationId, {
      headers: false,
      columnOrder: 'Логин|Пароль|Email|Fb_ID|Cookie',
      rememberLayout: true
    });
    const saved = service.savedLayouts();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].version, 1);
    const stored = JSON.stringify([...values]);
    for (const secret of [
      'synthetic.login',
      'SYNTHETIC_PASS_1',
      uid,
      'one@example.test',
      'SYNTHETIC_COOKIE'
    ])
      assert.equal(stored.includes(secret), false, 'no values stored: ' + secret);
  } finally {
    service.close();
  }
  const reopened = createClassificationService({ getStore: () => store });
  try {
    const output = await reopened.read(input(next), { headers: false });
    const first = reopened.page(output.operationId, 0).records[0];
    assert.equal(first.data.password, 'NEXT_PASS_ONLY');
    assert.equal(first.extended.login, 'next.login');
    assert.equal(first.data.accountId, '61500000123457');
    assert.equal(reopened.savedLayouts().length, 1);
    reopened.clearSavedLayouts();
    assert.equal(reopened.savedLayouts().length, 0);
    const cleared = await reopened.read(input(next), { headers: false });
    assert.equal(reopened.page(cleared.operationId, 0).records[0].data.password, '');
  } finally {
    reopened.close();
  }
});
