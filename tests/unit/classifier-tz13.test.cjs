const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fields, pairs, block } = require('../fixtures/classifier-tz13.cjs');
async function classify(text, format = 'txt', options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text), originalName: `synthetic.${format}` },
    { classification: true, ...options }
  );
  return { parsed, ...classifyRecords(parsed, options) };
}
function assertFields(record, expected) {
  for (const [key, value] of Object.entries(expected))
    assert.equal(record.data[key] ?? record.extended[key], value, key);
}
test('TZ13 vertical tab labels form one record and preserve every payload character and source span', async () => {
  const result = await classify(block);
  assert.equal(result.records.length, 1);
  assertFields(result.records[0], fields);
  assert.equal(result.records[0].sourceRecord, block);
  for (const entry of result.records[0].sourceEntries)
    assert.equal(block.slice(entry.range.start, entry.range.end), entry.value);
});
test('TZ13 horizontal tab label/value pairs protect separators, quotes and whitespace', async () => {
  const text = pairs.flat().join('\t');
  const result = await classify(text);
  assert.equal(result.records.length, 1);
  assertFields(result.records[0], fields);
});
test('TZ13 one-line labelled record tolerates an unpaired instruction and a profile URL as ID', async () => {
  const profileUrl = 'https://www.facebook.com/profile.php?id=61500000000000';
  const cookie = '[{"domain":".facebook.com","name":"c_user","value":"61500000000000"}]';
  const text = [
    'Login FB',
    '61500000000000',
    'Password',
    'FAKEPASS01',
    'Сервис входа на почту:',
    'https://example.invalid',
    'Email',
    'demo.fr@example.invalid',
    'Email password',
    'FAKEMAILPASS1',
    'Генерация кодов 2FA - OPEN LINK',
    'https://example.invalid/2fa/FAKE',
    'ID Account',
    profileUrl,
    'Date of Birth',
    '01.02.1994',
    'Token',
    'EAAB_FAKE_TEST_ONLY',
    'ИНСТРУКЦИЯ В ТЕЛЕГРАМ БОТЕ / INSTRUCTIONS - @example_bot',
    'User-agent',
    'Mozilla/5.0 (Synthetic Test)',
    'Cookie',
    cookie
  ].join('\t');
  const result = await classify(text);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assertFields(record, {
    login: '61500000000000',
    password: 'FAKEPASS01',
    email: 'demo.fr@example.invalid',
    emailPassword: 'FAKEMAILPASS1',
    accountId: '61500000000000',
    birthDate: '01.02.1994',
    token: 'EAAB_FAKE_TEST_ONLY',
    userAgent: 'Mozilla/5.0 (Synthetic Test)',
    cookies: cookie
  });
  assert.equal(record.sourceRecord, text);
  assert.equal(
    record.sourceEntries.find((entry) => entry.header === 'ID Account').value,
    profileUrl
  );
  assert.ok(record.unrecognized.some((entry) => entry.value === 'https://example.invalid'));
  assert.ok(record.unrecognized.some((entry) => entry.value.includes('ИНСТРУКЦИЯ')));
});
test('TZ13 labelled Facebook profile URL yields its numeric ID without relying on cookies', async () => {
  const url = 'https://www.facebook.com/profile.php?id=61500000000000';
  const result = await classify(`Login FB\tsynthetic.fr\tID Account\t${url}`);
  assert.equal(result.records[0].data.accountId, '61500000000000');
  assert.equal(result.records[0].sourceEntries[1].value, url);
  assert.equal(result.records[0].fieldSources.accountId[0].column, 'ID Account');
});
test('TZ13 instructions, URLs and unknown labels cannot shift or teach opaque credentials', async () => {
  const text = [
    'Instructions: synthetic fixture, do not sign in',
    'Login FB\tsynthetic.one',
    'ID Account\t000100013',
    'Help\thttps://example.test/path:password=NOT_A_PASSWORD',
    'Unknown field\tpassword=DO_NOT_CLASSIFY',
    'Email\tone@example.test',
    'Notes: retain unknown raw values'
  ].join('\n');
  const result = await classify(text);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assertFields(record, {
    login: 'synthetic.one',
    accountId: '000100013',
    email: 'one@example.test',
    password: '',
    emailPassword: ''
  });
  assert.ok(record.unrecognized.some((entry) => entry.value === 'password=DO_NOT_CLASSIFY'));
  assert.ok(record.warnings.some((w) => w.code === 'UNRECOGNIZED_VALUES'));
  assert.equal(record.sourceRecord, text);
});
test('TZ13 repeated login starts the next block without inheriting missing secrets', async () => {
  const next = 'Login FB\tsynthetic.two\nEmail\ttwo@example.test\nID Account\t000100014';
  for (const separator of ['\n', '\n\n']) {
    const result = await classify(block + separator + next);
    assert.equal(result.records.length, 2);
    assertFields(result.records[0], fields);
    assertFields(result.records[1], {
      login: 'synthetic.two',
      email: 'two@example.test',
      accountId: '000100014',
      password: '',
      emailPassword: ''
    });
  }
});
test('TZ13 duplicate conflicting labels retain both raw values and report ambiguity', async () => {
  const text =
    'Login FB\tsynthetic.one\nID Account\t000100013\nEmail password\tFIRST_SYNTHETIC\nMail password\tSECOND_SYNTHETIC';
  const result = await classify(text);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.data.emailPassword, '');
  assert.ok(
    record.warnings.some((w) => w.code === 'AMBIGUOUS_FIELD' && w.column === 'emailPassword')
  );
  for (const value of ['FIRST_SYNTHETIC', 'SECOND_SYNTHETIC'])
    assert.ok(record.unrecognized.some((entry) => entry.value === value));
});
test('TZ13 requested aliases also work in ordinary header tables', async () => {
  const headers = ['Login FB', 'ID Account', 'Date of Birth', 'Cookie JSON'];
  const values = ['synthetic.one', '000100013', '1991-09-18', fields.cookies];
  const result = await classify(headers.join('\t') + '\n' + values.join('\t'));
  assert.equal(result.records.length, 1);
  assertFields(result.records[0], {
    login: values[0],
    accountId: values[1],
    birthDate: values[2],
    cookies: values[3]
  });
});
test('TZ13 global manual assignment overrides headers and selected schemas across formats', async () => {
  for (const format of ['txt', 'csv', 'tsv', 'json']) {
    const text =
      format === 'json'
        ? JSON.stringify([{ Email: 'synthetic@example.test', Password: 'SYNTHETIC_ACCOUNT' }])
        : `Email${format === 'csv' ? ',' : '\t'}Password\nsynthetic@example.test${format === 'csv' ? ',' : '\t'}SYNTHETIC_ACCOUNT`;
    const result = await classify(text, format, { mapping: { Email: 'emailPassword' } });
    assert.equal(result.records[0].data.emailPassword, 'synthetic@example.test', format);
    assert.equal(result.records[0].data.email, '', format);
    assert.equal(result.records[0].fieldSources.emailPassword[0].method, 'manual');
  }
  const result = await classify(
    'synthetic.login:SYNTHETIC_PASS:one@example.test:SYNTHETIC_MAIL:SYNTHETIC_2FA:000100013',
    'txt',
    { schema: 'credentials6', mapping: { column_2: 'token' } }
  );
  assert.equal(result.records[0].extended.login, 'synthetic.login');
  assert.equal(result.records[0].data.password, '');
  assert.equal(result.records[0].data.token, 'SYNTHETIC_PASS');
});

test('TZ13 pretty Cookie JSON and invalid-date payloads retain exact source text', async () => {
  const cookie =
    '[\r\n\t{"name":"c_user","value":"000100013"},\r\n\t{"name":"xs","value":"SYNTHETIC:;|\\\"quote\\\""}\r\n]';
  const text = `Login FB\tsynthetic.one\r\nID Account\t000100013\r\nCookie JSON\t${cookie}\r\nDate of Birth\t31/02/2000\r\nPassword\t2fa=SYNTHETIC_LITERAL_PASSWORD`;
  const result = await classify(text);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.data.cookies, cookie);
  assert.equal(record.data.password, '2fa=SYNTHETIC_LITERAL_PASSWORD');
  assert.equal(record.data.birthDate, '');
  assert.ok(record.warnings.some((w) => w.code === 'INVALID_FIELD'));
  const entry = record.sourceEntries.find((entry) => entry.header === 'Cookie JSON');
  assert.equal(text.slice(entry.range.start, entry.range.end), cookie);
});

test('TZ13 manual row mapping wins over column mapping and strips only actual inline label syntax', async () => {
  const text = 'id=000100013 | email=synthetic@example.test';
  const result = await classify(text, 'txt', {
    mapping: { column_2: 'emailPassword' },
    recordMapping: { 1: { column_2: 'password' } }
  });
  assert.equal(result.records[0].data.password, 'synthetic@example.test');
  assert.equal(result.records[0].data.emailPassword, '');
  assert.equal(result.records[0].data.email, '');
  assert.equal(result.records[0].sourceEntries[1].value, 'email=synthetic@example.test');
});
