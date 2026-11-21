const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classify(lines) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const text = [
    'Номер заказа: 992033',
    'Наименование: FR PRO test',
    'Ваш заказ:',
    ...lines,
    '--------------------',
    'Купон: TEST_ONLY'
  ].join('\n');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic-fr-receipt.txt' },
    { classification: true }
  );
  return classifyRecords(parsed);
}

function syntheticRow(
  index,
  { missingName = false, wrongOwner = false, differentEmail = false } = {}
) {
  const id = '615000000' + String(index).padStart(5, '0');
  const email = 'receipt' + index + '@example.test';
  const accountPassword = 'SyntheticFb' + index + 'A7';
  const mailPassword = 'SyntheticMail' + index + 'B!4567';
  const cookie = JSON.stringify([
    { name: 'c_user', value: wrongOwner ? '61599999999999' : id },
    { name: 'xs', value: 'FAKE_COOKIE_ONLY' }
  ]);
  const details = [
    differentEmail ? 'other@example.test' : email + '.',
    accountPassword,
    mailPassword,
    '17.3.1989',
    id,
    missingName ? ' ' : 'Example Person',
    'https://2fa.fb.rip/',
    'LIMIT 50',
    'GEO France',
    'БМ1 FAKE_TOKEN',
    '1197679421773001',
    'БМ2 FAKE_TOKEN',
    '1140994734331449',
    'FP YES',
    'AVA',
    'DOC',
    '0',
    '#2'
  ].join(';');
  return {
    id,
    email,
    accountPassword,
    mailPassword,
    row: [
      email + '.',
      'FAKE_TOKEN',
      'Mozilla/5.0 (Synthetic; Test) Chrome/131.0',
      '',
      cookie,
      accountPassword,
      details
    ].join(' :: ')
  };
}

test('TZ35: 14 French receipt accounts retain two passwords when one record has no FIO', async () => {
  const fixtures = Array.from({ length: 14 }, (_, i) =>
    syntheticRow(i + 1, { missingName: i === 2 })
  );
  const output = await classify(fixtures.map((item) => item.row));
  assert.equal(output.records.length, fixtures.length);
  for (let i = 0; i < fixtures.length; i++) {
    const row = output.records[i];
    const expected = fixtures[i];
    assert.equal(row.data.email, expected.email);
    assert.equal(row.data.accountId, expected.id);
    assert.equal(row.data.password, expected.accountPassword);
    assert.equal(row.data.emailPassword, expected.mailPassword);
    assert.equal(row.data.fullName, i === 2 ? '' : 'Example Person');
    assert.equal(row.sourceRecord, expected.row);
  }
});

test('TZ35: missing name alone does not permit passwords without a matching Cookie owner', async () => {
  const fixture = syntheticRow(1, { missingName: true, wrongOwner: true });
  const output = await classify([fixture.row]);
  assert.equal(output.records[0].data.password, '');
  assert.equal(output.records[0].data.emailPassword, '');
});

test('TZ35: missing name and different repeated email remain reviewable', async () => {
  const fixture = syntheticRow(1, { missingName: true, differentEmail: true });
  const output = await classify([fixture.row]);
  assert.equal(output.records[0].data.password, '');
  assert.equal(output.records[0].data.emailPassword, '');
});
