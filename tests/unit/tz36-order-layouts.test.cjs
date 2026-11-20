const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classify(text) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic-order.txt' },
    { classification: true }
  );
  return { parsed, output: classifyRecords(parsed) };
}

const id = (i) => '615900000' + String(i).padStart(5, '0');
const cookie = (i, owner = id(i)) =>
  JSON.stringify([
    { name: 'datr', value: 'FAKE_NON_SESSION' },
    { name: 'c_user', value: owner },
    { name: 'xs', value: 'FAKE_NOT_A_SESSION' }
  ]);
const profile = (i) => 'https://www.facebook.com/profile.php?id=' + id(i);
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0';
const token = 'EAAB_FAKE_TEST_TOKEN';

function hybridLine(i) {
  const email = 'synthetic' + i + '@example.test';
  const fbPass = 'SyntheticFb' + i + 'A7';
  const mailPass = 'SyntheticMail' + i + 'B!1234';
  if (i === 1) {
    return {
      email, fbPass, mailPass,
      line: [
        email, fbPass, mailPass, token, ua, profile(i), cookie(i),
        '6.1.1993', 'Example Person', 'https://2fa.fb.rip/',
        'LIMIT 50', 'GEO France', 'FP YES', 'AVA', 'DOC', 'sent', 'friend 0', '#2'
      ].join('|')
    };
  }
  return {
    email, fbPass, mailPass,
    line: [
      email + '.', token, ua, '', cookie(i), fbPass,
      [
        email + '.', fbPass, mailPass, '04.08.1952', id(i),
        i < 4 ? 'Ksyusha' : 'Example Person',
        'https://2fa.fb.rip/', 'LIMIT 50', 'GEO France', 'БМ1 FAKE',
        '1197679421773001', 'БМ2 FAKE', '1140994734331449',
        'FP YES', 'AVA', 'DOC', 'sent', 'friend 0', '#2'
      ].join(';')
    ].join(' :: ')
  };
}

function pipeLine(i, owner = id(i)) {
  const email = 'test' + i + '@example.test';
  const mail = 'mail' + i + '@example.test';
  const fbPass = 'SyntheticFb' + i + 'A8';
  const mailPass = 'SyntheticMail' + i + 'C!4567';
  return {
    email, mail, fbPass, mailPass,
    line: [
      email, fbPass, '16-03-2002', profile(i), ua, token,
      mail + ':' + mailPass, cookie(i, owner),
      'ABCD EFGH IJKL MNOP QRST UVWX YZAB CDEF',
      '', '', '', '', '', ''
    ].join('|')
  };
}

test('TZ36 mixed file: 1 pipe row and 4 double-colon rows each have two distinct passwords', async () => {
  const examples = Array.from({ length: 5 }, (_, i) => hybridLine(i + 1));
  const text = examples.map((r) => r.line).join('\n') +
    '\n--------------------\nКупон на скидку: SYNTHETIC';
  const { parsed, output } = await classify(text);
  assert.equal(parsed.records.length, 5);
  assert.equal(output.records.length, 5);
  for (const [n, example] of examples.entries()) {
    const record = output.records[n];
    assert.equal(record.data.email, example.email);
    assert.equal(record.data.accountId, id(n + 1));
    assert.equal(record.data.password, example.fbPass);
    assert.equal(record.data.emailPassword, example.mailPass);
    assert.equal(record.sourceRecord, example.line);
    assert.ok(record.data.cookies);
  }
});

test('TZ36 pipe receipts: mail:password cell is split, one owner remains per row and 2FA is not a password', async () => {
  const examples = Array.from({ length: 5 }, (_, i) => pipeLine(i + 1));
  const text = [
    'Номер заказа: 992010',
    'Наименование: Facebook тестовые аккаунты',
    'Ваш заказ:',
    ...examples.map((r) => r.line)
  ].join('\n');
  const { parsed, output } = await classify(text);
  assert.equal(parsed.records.length, 5);
  assert.equal(output.records.length, 5);
  for (const [n, example] of examples.entries()) {
    const record = output.records[n];
    assert.equal(record.data.email, example.email);
    assert.equal(record.data.backupEmail, example.mail);
    assert.equal(record.data.accountId, id(n + 1));
    assert.equal(record.data.password, example.fbPass);
    assert.equal(record.data.emailPassword, example.mailPass);
    assert.equal(record.sourceRecord, example.line);
    assert.ok(record.data.cookies);
  }
});

test('TZ36 pipe receipts refuse inferred unlabelled secrets with conflicting cookie owner', async () => {
  const example = pipeLine(1, '61599999999999');
  const { output } = await classify([
    'Номер заказа: 992010',
    'Наименование: Facebook тестовые аккаунты',
    'Ваш заказ:',
    example.line
  ].join('\n'));
  assert.equal(output.records.length, 1);
  assert.equal(output.records[0].data.password, '');
  assert.equal(output.records[0].data.emailPassword, '');
});
