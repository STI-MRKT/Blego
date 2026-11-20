const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classifyReceipt(text) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic-receipt.txt' },
    { classification: true }
  );
  return { parsed, output: classifyRecords(parsed) };
}

function example(index, ownerOverride = null) {
  const number = String(index).padStart(5, '0');
  const id = '615000000' + number;
  const bm1 = '3020000000' + String(index).padStart(6, '0');
  const bm2 = '4120000000' + String(index).padStart(6, '0');
  const email = 'synthetic' + index + '@example.test';
  const password = 'SyntheticFb' + index + 'X7';
  const emailPassword = 'SyntheticMail' + index + 'Y!1234';
  const cookies = JSON.stringify([
    { name: 'c_user', value: ownerOverride || id },
    { name: 'xs', value: 'FAKE_NON_SESSION' }
  ]);
  const line = [
    email + '.',
    'FAKE_TOKEN_' + index,
    'Mozilla/5.0 (Synthetic; Test) Chrome/144.0',
    '',
    cookies,
    password,
    [
      email + '.',
      password,
      emailPassword,
      '9.10.1995',
      id,
      'Ada Lovelace',
      'https://2fa.fb.rip/',
      'LIMIT 50',
      'GEO Spain',
      'БМ1 FAKE_TOKEN_1',
      bm1,
      'БМ2 FAKE_TOKEN_2',
      bm2,
      'FP YES 61570000000000',
      'AVA',
      'DOC',
      'sent 0',
      'friend 0',
      '#2'
    ].join(';')
  ].join(' :: ');
  return { id, bm1, bm2, email, password, emailPassword, line };
}

function receipt(lines) {
  return [
    'Номер заказа: 123456',
    'Наименование: ES PRO | тестовые аккаунты',
    '================================================',
    'Формат выдачи:',
    'Ваш заказ:',
    ...lines,
    '--------------------',
    'Купон на скидку: SYNTHETIC_NOT_A_SECRET'
  ].join('\n');
}

test('TZ34 receipt: recover two distinct passwords per row despite extra BM IDs', async () => {
  const fixtures = Array.from({ length: 15 }, (_, i) => example(i + 1));
  const { parsed, output } = await classifyReceipt(receipt(fixtures.map((x) => x.line)));

  assert.equal(parsed.records.length, 15);
  assert.equal(output.records.length, 15);
  for (const [index, expected] of fixtures.entries()) {
    const row = output.records[index];
    assert.equal(row.data.email, expected.email, 'email owner ' + index);
    assert.equal(row.data.accountId, expected.id, 'cookie-owned account ID ' + index);
    assert.equal(row.data.password, expected.password, 'Facebook password ' + index);
    assert.equal(
      row.data.emailPassword,
      expected.emailPassword,
      'email password ' + index
    );
    assert.notEqual(row.data.password, row.data.emailPassword);
    assert.notEqual(row.data.accountId, expected.bm1);
    assert.notEqual(row.data.accountId, expected.bm2);
    assert.equal(row.sourceRecord, expected.line);
    assert.ok(row.fieldSources.password?.length);
    assert.ok(row.fieldSources.emailPassword?.length);
  }
});

test('TZ34 receipt: do not infer unlabelled passwords when Cookie owner is unmatched', async () => {
  const fixture = example(1, '61599999999999');
  const { output } = await classifyReceipt(receipt([fixture.line]));
  assert.equal(output.records.length, 1);
  assert.equal(output.records[0].data.password, '');
  assert.equal(output.records[0].data.emailPassword, '');
});
