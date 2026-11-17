const { test } = require('node:test');
const assert = require('node:assert/strict');
async function scan(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text), originalName: 'synthetic.txt' },
    { classification: true, ...options }
  );
  return { parsed, ...classifyRecords(parsed, options) };
}
const id = '61500000123456';
function row({ password = 'QATest7kL2', mail = 'Mailsecret!4567', secondMail = '' } = {}) {
  return [
    ':: ' + password + ' ::',
    'synthetic.one@example.test.',
    password,
    ...(secondMail ? [secondMail] : []),
    mail,
    '1.11.1998',
    id,
    'Desi Sample',
    'https://example.test/2fa',
    'LIMIT 50',
    'GEO Spain',
    'БМ1'
  ].join(';');
}
test('TZ15 real-world-shaped opaque mixed tuple: distinct FB and email passwords, UID, DOB, name, GEO', async () => {
  const text = row();
  const result = await scan(text);
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  for (const [key, value] of Object.entries({
    password: 'QATest7kL2', emailPassword: 'Mailsecret!4567',
    email: 'synthetic.one@example.test', accountId: id,
    fullName: 'Desi Sample', birthDate: '1.11.1998', geo: 'Spain'
  }))
    assert.equal(record.data[key], value, key);
  assert.equal(record.extended.limit, '50');
  assert.ok(record.unrecognized.some((r) => r.value === 'БМ1'));
  assert.equal(record.sourceRecord, text);
  assert.equal(record.fieldSources.password[0].method, 'record-local-layout');
  assert.ok(record.warnings.some((w) => w.code === 'CREDENTIAL_LAYOUT_INFERRED'));
});

test('TZ15 second email stays in backupEmail for the same anchored account', async () => {
  const text = row({ password: 'tabassum@27', secondMail: 'synthetic.alt@example.test' });
  const { records } = await scan(text);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.data.email, 'synthetic.one@example.test');
  assert.equal(record.data.backupEmail, 'synthetic.alt@example.test');
  assert.equal(record.data.password, 'tabassum@27');
  assert.equal(record.data.emailPassword, 'Mailsecret!4567');
  assert.equal(record.fieldSources.backupEmail[0].method, 'record-local-layout');
});

test('TZ15 underline divider blocks have separate record and never borrow passwords', async () => {
  for (const divider of ['==========================', '--------------------------']) {
    const text = [
      row({ password: 'QATest7kL2' }),
      divider,
      'INFO: cannot interpret these notes; unrelated!4590',
      'other@example.test',
      divider,
      row({ password: 'Second7kL2', mail: 'SecondMail!8901' }).replaceAll(id, '61500000123457')
    ].join('\n');
    const { records } = await scan(text);
    assert.equal(records.length, 3);
    assert.equal(records[0].data.password, 'QATest7kL2');
    assert.equal(records[0].data.emailPassword, 'Mailsecret!4567');
    assert.equal(records[1].data.password, '');
    assert.equal(records[1].data.emailPassword, '');
    assert.equal(records[2].data.accountId, '61500000123457');
    assert.equal(records[2].data.password, 'Second7kL2');
    assert.equal(records[2].data.emailPassword, 'SecondMail!8901');
    assert.equal(records[0].sourceRecord, row());
    assert.ok(!records[0].sourceRecord.includes('other@example.test'));
  }
});

test('TZ15 uncertain / partial records do not guess secrets', async () => {
  const text = 'secretABC2;a@example.test;Mail!4567;notes';
  const { records } = await scan(text);
  assert.equal(records[0].data.password, '');
  assert.equal(records[0].data.emailPassword, '');
  assert.ok(records[0].unrecognized.some((e) => e.value === 'secretABC2'));
  assert.ok(records[0].unrecognized.some((e) => e.value === 'Mail!4567'));
});

test('TZ15 ambiguous unrelated secrets fail closed and remain reviewable', async () => {
  const text = [
    'OtherABC9', 'a@example.test', 'secondXYZ8', 'MailSecret!3456',
    '1.11.1998', id, 'Desi Sample', 'GEO Spain'
  ].join(';');
  const { records } = await scan(text);
  assert.equal(records[0].data.password, '');
  assert.equal(records[0].data.emailPassword, 'MailSecret!3456');
  assert.ok(records[0].unrecognized.some((e) => e.value === 'OtherABC9'));
  assert.ok(records[0].unrecognized.some((e) => e.value === 'secondXYZ8'));
});

test('TZ15 manual field override stays higher priority than record-local inference', async () => {
  const text = row();
  const { records } = await scan(text, { mapping: { column_4: 'token' } });
  assert.equal(records[0].extended.token, 'Mailsecret!4567');
  assert.equal(records[0].data.emailPassword, '');
  assert.equal(records[0].data.password, 'QATest7kL2');
});

test('TZ15 labelled or colon-separated values remain authoritative and exact', async () => {
  for (const delim of [';', '|', ':']) {
    const text = [
      'Login:sample.user', 'Password:QAFbTest@27', 'Email:one@example.test',
      'Email Password:QAMail!3333', 'ID Account:' + id,
      'Date of Birth:1.11.1998', 'GEO:Spain'
    ].join(delim);
    const { records } = await scan(text);
    assert.equal(records.length, 1);
    const record = records[0];
    assert.equal(record.data.password, 'QAFbTest@27', delim);
    assert.equal(record.data.emailPassword, 'QAMail!3333', delim);
    assert.equal(record.data.accountId, id, delim);
    assert.equal(record.data.email, 'one@example.test', delim);
  }
});
