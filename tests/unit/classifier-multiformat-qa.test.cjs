const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classify(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic.txt' },
    { classification: true, ...options }
  );
  return { parsed, output: classifyRecords(parsed, options) };
}

const ids = ['000100013', '000100014'];

function expected(id, withMailPassword = true) {
  return {
    login: 'synthetic.login.' + id,
    password: 'FAKE_ACCOUNT_' + id,
    email: 'synthetic.' + id + '@example.test',
    emailPassword: withMailPassword ? 'FAKE_MAIL_' + id : '',
    accountId: id,
    birthDate: '1991-09-18',
    userAgent: 'Mozilla/5.0 (Synthetic; Test) Chrome/125',
    cookies: JSON.stringify([
      { name: 'c_user', value: id },
      { name: 'xs', value: 'FAKE:;|NOT_A_SESSION' }
    ])
  };
}

function row(id, delimiter, withMailPassword) {
  const f = expected(id, withMailPassword);
  const cells = [
    'Login FB:' + f.login,
    'Password:' + f.password,
    'Email:' + f.email,
    ...(withMailPassword ? ['Email password:' + f.emailPassword] : []),
    'ID Account:https://www.facebook.com/profile.php?id=' + id,
    'Date of Birth:' + f.birthDate,
    'Инструкция:не входить в тестовый аккаунт',
    'User-agent:' + f.userAgent,
    'Cookie:' + f.cookies
  ];
  return cells.join(delimiter);
}

function expectRecord(record, f, source) {
  const get = (key) => record.data[key] ?? record.extended[key];
  for (const [key, value] of Object.entries(f)) {
    assert.equal(get(key), value, key);
  }
  assert.equal(record.sourceRecord, source);
  for (const entry of record.sourceEntries) {
    assert.equal(
      source.slice(entry.range.start - record.range.start, entry.range.end - record.range.start),
      entry.value
    );
  }
}

for (const [name, delimiter] of [
  ['pipe', '|'],
  ['semicolon', ';'],
  ['colon', ':']
]) {
  test(
    'QA multi-record ' + name + ': keep account boundaries, passwords and literal cookie JSON',
    async () => {
      const sourceLines = [row(ids[0], delimiter, true), row(ids[1], delimiter, false)];
      const { output } = await classify(sourceLines.join('\n'));
      assert.equal(output.records.length, 2);
      expectRecord(output.records[0], expected(ids[0], true), sourceLines[0]);
      expectRecord(output.records[1], expected(ids[1], false), sourceLines[1]);
      assert.notEqual(output.records[0].data.accountId, output.records[1].data.accountId);
      assert.ok(!output.records[1].sourceRecord.includes('FAKE_MAIL_' + ids[0]));
    }
  );
}

test('QA mixed delimiters: unknown instruction does not shift following labelled values', async () => {
  const f = expected(ids[0]);
  const source = [
    'Login FB:' + f.login,
    'Password:' + f.password,
    'НЕИЗВЕСТНАЯ ИНСТРУКЦИЯ',
    'Email:' + f.email,
    'Email password:' + f.emailPassword,
    'ID Account:https://www.facebook.com/profile.php?id=' + ids[0],
    'Date of Birth:' + f.birthDate,
    'User-agent:' + f.userAgent,
    'Cookie:' + f.cookies
  ].join('|');
  const { output } = await classify(source);
  assert.equal(output.records.length, 1);
  expectRecord(output.records[0], f, source);
  assert.ok(output.records[0].unrecognized.length > 0);
});

test('QA double-colon: explicit credentials6 schema preserves two records without borrowing', async () => {
  const lines = [
    ['synthetic.a', 'FAKE_A', 'a@example.test', 'FAKE_MAIL_A', 'FAKE_2FA_A', ids[0]].join('::'),
    ['synthetic.b', 'FAKE_B', 'b@example.test', '', 'FAKE_2FA_B', ids[1]].join('::')
  ];
  const { output } = await classify(lines.join('\n'), { schema: 'credentials6' });
  assert.equal(output.records.length, 2);
  assert.equal(output.records[0].extended.login, 'synthetic.a');
  assert.equal(output.records[0].data.password, 'FAKE_A');
  assert.equal(output.records[0].data.emailPassword, 'FAKE_MAIL_A');
  assert.equal(output.records[0].data.accountId, ids[0]);
  assert.equal(output.records[1].extended.login, 'synthetic.b');
  assert.equal(output.records[1].data.password, 'FAKE_B');
  assert.equal(output.records[1].data.emailPassword, '');
  assert.equal(output.records[1].data.accountId, ids[1]);
  assert.deepEqual(
    output.records.map((r) => r.sourceRecord),
    lines
  );
});

test('QA double-colon without schema: ambiguous opaque credentials are not invented', async () => {
  const lines = [
    ['synthetic.a', 'FAKE_A', 'a@example.test', 'FAKE_MAIL_A', ids[0]].join('::'),
    ['synthetic.b', 'FAKE_B', 'b@example.test', 'FAKE_MAIL_B', ids[1]].join('::')
  ];
  const { output } = await classify(lines.join('\n'));
  assert.equal(output.records.length, 2);
  assert.deepEqual(
    output.records.map((r) => r.sourceRecord),
    lines
  );
  assert.equal(output.records[0].data.email, 'a@example.test');
  assert.equal(output.records[1].data.email, 'b@example.test');
  assert.equal(output.records[0].data.password, '');
  assert.equal(output.records[1].data.emailPassword, '');
});
