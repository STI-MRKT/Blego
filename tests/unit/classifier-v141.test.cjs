const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatA, formatB, cookie } = require('../fixtures/classifier-v14.cjs');
async function read(text) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text), originalName: 'synthetic.txt' },
    { classification: true }
  );
  return { parsed, ...classifyRecords(parsed) };
}
test('TZ06 labelled recovery email is separate from primary email and seven-field schema', async () => {
  for (const label of [
    'backup email',
    'recovery email',
    'reserve mail',
    'резервная почта',
    'запасная почта',
    'почта восстановления'
  ]) {
    const r = (await read(formatA() + `::${label}:recovery@example.test`)).records[0];
    assert.equal(r.data.backupEmail, 'recovery@example.test', label);
    assert.equal(r.data.email, 'one@example.test');
  }
  const { CORE_FIELDS, SCHEMAS } = await import('../../shared/classifier.mjs');
  assert.equal(CORE_FIELDS.length, 7);
  assert.equal(SCHEMAS.full10.length, 10);
  assert.equal(SCHEMAS.numbered11.length, 11);
});
test('TZ06 skips prose around 20 useful records, retaining exact spans and multiline values', async () => {
  const notes = Array.from({ length: 10 }, (_, i) =>
    i % 2
      ? 'Read terms before use. Contact support@example.test for help.'
      : 'Описание файла. Прочитайте условия использования.'
  ).join('\n');
  const rows = Array.from({ length: 20 }, (_, i) =>
    i % 2 ? formatB(String(100000 + i)) : formatA(String(100000 + i))
  );
  const text = notes + '\n\n' + rows.join('\n\n# Комментарий между записями\n\n');
  const result = await read(text);
  assert.equal(result.records.length, 20);
  result.records.forEach((r, i) => {
    assert.equal(r.data.accountId, String(100000 + i));
    assert.equal(r.sourceRecord, text.slice(r.range.start, r.range.end));
    assert.equal(
      r.data.cookies,
      i % 2 ? cookie(String(100000 + i)) : cookie(String(100000 + i)).replace('},', '},\n')
    );
  });
});
test('TZ06 infers standalone country and name with identity/date context, not countries in prose', async () => {
  for (const geo of ['GB', 'United Kingdom', 'Великобритания', 'Italy', 'Италия']) {
    const r = (
      await read(`https://facebook.com/profile.php?id=0009|5.10.1984|Алёна Примерова|${geo}`)
    ).records[0];
    assert.equal(r.data.geo, geo);
    assert.equal(r.data.fullName, 'Алёна Примерова');
  }
  const r = (await read('id:0009|A story about Italy|31.2.2000|one@example.test|two@example.test'))
    .records[0];
  assert.equal(r.data.geo, '');
  assert.equal(r.data.birthDate, '');
  assert.equal(r.data.email, '');
  assert.equal(r.data.backupEmail, '');
});
test('TZ06 repeats only explicitly anchored file structure and never guesses adjacent passwords', async () => {
  const text = [
    'id:0001|password:FAKE_A|email:first@example.test|emailPassword:FAKE_MA|GEO IT',
    'id:0002|password:FAKE_B|email:second@example.test|emailPassword:FAKE_MB|GEO IT',
    'id:0003|FAKE_C|third@example.test|FAKE_MC|GEO IT'
  ].join('\n');
  const r = (await read(text)).records[2];
  assert.equal(r.data.password, 'FAKE_C');
  assert.equal(r.data.emailPassword, 'FAKE_MC');
  const ambiguous = (await read('id:0004|unlabelled|one@example.test|another')).records[0];
  assert.equal(ambiguous.data.password, '');
  assert.equal(ambiguous.data.emailPassword, '');
  const shifted = (await read(text + '\nid:0005|one@example.test|shifted|FAKE_X|GEO IT'))
    .records[3];
  assert.equal(shifted.data.password, '');
});
