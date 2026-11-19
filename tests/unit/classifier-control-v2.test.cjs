const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Classifier 2.0 supplied sanitized control retains fields, source spans and ambiguity', async () => {
  const filename = path.resolve(__dirname, '../fixtures/BLEGO_TZ13_CONTROL_SANITIZED.txt');
  const source = fs.readFileSync(filename, 'utf8').trimEnd();
  assert.equal(source.split('\n').length, 1);
  const cells = source.split('\t');
  const valueAfter = (label) => cells[cells.indexOf(label) + 1];
  assert.ok(cells.length >= 20);
  assert.equal(valueAfter('Password'), 'FAKEPASS01');
  assert.equal(valueAfter('Email password'), 'FAKEMAILPASS1');
  assert.ok(valueAfter('Token').startsWith('EAAB_FAKE_TEST_ONLY_'));
  assert.equal(new URL(valueAfter('Сервис входа на почту:')).hostname, 'example.invalid');
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(source), originalName: path.basename(filename) },
    { classification: true }
  );
  const result = classifyRecords(parsed);
  assert.equal(result.records.length, 1);
  const row = result.records[0];
  assert.equal(row.extended.login, valueAfter('Login FB'));
  assert.equal(row.data.password, valueAfter('Password'));
  assert.equal(row.data.email, valueAfter('Email'));
  assert.equal(row.data.emailPassword, valueAfter('Email password'));
  assert.equal(row.data.accountId, new URL(valueAfter('ID Account')).searchParams.get('id'));
  assert.equal(row.data.birthDate, valueAfter('Date of Birth'));
  assert.equal(row.data.token, valueAfter('Token'));
  assert.equal(row.data.userAgent, valueAfter('User-agent'));
  assert.equal(row.data.cookies, valueAfter('Cookie'));
  assert.equal(row.sourceRecord, source);
  assert.equal(JSON.parse(row.data.cookies)[0].name, 'c_user');
  for (const entry of row.sourceEntries)
    assert.equal(source.slice(entry.range.start, entry.range.end), entry.value);
  assert.ok(row.unrecognized.length > 0);
  assert.ok(row.warnings.some((warning) => warning.code === 'UNRECOGNIZED_VALUES'));
});
