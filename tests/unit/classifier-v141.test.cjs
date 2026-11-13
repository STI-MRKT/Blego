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

test('TZ06 detects bounded structured Windows-1251 and BOM-less UTF16 without accepting arbitrary corrupt bytes', async () => {
  const { parseInput } = await import('../../shared/importer.mjs');
  const cp = Buffer.concat([
    Buffer.from('id:0001|name:'),
    Buffer.from([0xc0, 0xed, 0xed, 0xe0, 0x20, 0xcf, 0xe5, 0xf2, 0xf0, 0xee, 0xe2, 0xe0]),
    Buffer.from('|geo:RU')
  ]);
  const p = await parseInput({ bytes: cp, originalName: 'input.txt' }, { classification: true });
  assert.equal(p.encoding, 'windows-1251');
  assert.ok(p.text.includes('Анна Петрова'));
  for (const big of [false, true]) {
    const bytes = Buffer.from('id:0002|name:Анна Петрова|geo:RU', 'utf16le');
    if (big) bytes.swap16();
    const r = await parseInput({ bytes, originalName: 'input.txt' }, { classification: true });
    assert.equal(r.encoding, big ? 'utf-16be' : 'utf-16le');
    assert.ok(r.text.includes('Анна Петрова'));
  }
  await assert.rejects(
    parseInput({ bytes: Buffer.from([255]), originalName: 'input.txt' }, { classification: true })
  );
});

test('mixed TXT retains weak, partial and extended-only records for manual review', async () => {
  const rows = [
    'id:0001|email:first@example.test',
    '0002|second@example.test|FAKE_PASSWORD',
    'name:Jane Doe|recoveryEmail:backup@example.test',
    'profileUrl:https://facebook.com/example.person',
    'uncertain-value'
  ];
  const r = await read(rows.join('\n'));
  assert.equal(r.records.length, rows.length);
  assert.deepEqual(
    r.records.map((x) => x.sourceRecord),
    rows
  );
  assert.equal(r.records[1].data.password, '');
  assert.equal(r.records[2].data.backupEmail, 'backup@example.test');
  assert.equal(r.records[3].extended.profileUrl, 'https://facebook.com/example.person');
});
