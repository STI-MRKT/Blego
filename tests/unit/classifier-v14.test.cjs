const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cookie, formatA, formatB } = require('../fixtures/classifier-v14.cjs');
async function read(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text), originalName: 'synthetic.txt' },
    { classification: true, ...options }
  );
  return { parsed, ...classifyRecords(parsed, options) };
}
test('format A recognizes explicit fields and multiline JSON without splitting UA semicolons', async () => {
  const text = formatA();
  const result = await read(text);
  assert.equal(result.records.length, 1);
  const r = result.records[0];
  assert.equal(r.data.accountId, '00010001');
  assert.equal(r.data.password, 'FAKE_ACCOUNT_PASSWORD');
  assert.equal(r.data.emailPassword, 'FAKE_MAIL_PASSWORD');
  assert.equal(r.data.token, 'FAKE_OPAQUE_TOKEN');
  assert.equal(r.data.userAgent, 'Mozilla/5.0 (Synthetic; Test)');
  assert.equal(r.data.cookies, cookie('00010001').replace('},', '},\n'));
  assert.equal(r.data.fullName, 'Ирина Тестовая');
  assert.equal(r.data.geo, 'USA');
  assert.equal(r.extended.limit, '50');
  assert.equal(r.sourceRecord, text);
});
test('format B uses identity context and preserves empty/unknown fields and extended labels', async () => {
  const result = await read(formatB());
  assert.equal(result.records.length, 1);
  const r = result.records[0];
  assert.equal(r.data.accountId, '00010002');
  assert.equal(r.data.cookies, cookie('00010002'));
  assert.equal(r.data.birthDate, '5.10.1984');
  assert.equal(r.data.fullName, 'Алёна Примерова');
  assert.equal(r.data.geo, 'Italy');
  assert.equal(r.data.password, '');
  assert.equal(r.data.emailPassword, '');
  assert.ok(r.extraFields.some((e) => e.value === 'FAKE_UNASSIGNED_PASSWORD'));
  assert.equal(r.extended.avatarUrl, 'https://example.test/avatar.png');
  assert.equal(r.extended.documentUrl, 'https://example.test/document');
  assert.equal(r.extended.fpStatus, 'NO');
  assert.equal(r.extended.sentCount, '3');
  assert.equal(r.extended.friendsInfo, '12');
  assert.equal(r.confidence, 'review');
  assert.ok(result.parsed.records[0].sourceEntries.some((e) => e.value === ''));
});
test('mixed formats and two same-line records keep exact source spans and row cookies', async () => {
  for (const separator of ['\r\n', '; ']) {
    const text = formatA('00020001') + separator + formatA('00020002');
    const r = await read(text);
    assert.equal(r.records.length, 2);
    for (const [i, row] of r.records.entries()) {
      assert.equal(row.data.accountId, `0002000${i + 1}`);
      assert.equal(row.data.cookies, cookie(row.data.accountId).replace('},', '},\n'));
      assert.equal(text.slice(row.range.start, row.range.end), row.sourceRecord);
    }
  }
  const mixed = await read(formatA() + '\n' + formatB());
  assert.equal(mixed.records.length, 2);
  assert.equal(mixed.records[1].data.accountId, '00010002');
});
test('conflicting URL/cookie identities remain warnings and cannot silently select an owner', async () => {
  const r = (
    await read(`https://facebook.com/profile.php?id=00030001|${cookie('00030002')}|GEO USA`)
  ).records[0];
  assert.equal(r.data.accountId, '');
  assert.ok(r.warnings.some((w) => w.code === 'IDENTITY_CONFLICT'));
  assert.equal(r.data.cookies, cookie('00030002'));
});
test('broken JSON recovers at a strong next-record boundary without borrowing its cookie', async () => {
  const text = 'id:00040001::[{"name":"synthetic","value":"FAKE_BROKEN"\n' + formatA('00040002');
  const r = await read(text);
  assert.equal(r.records.length, 2);
  assert.equal(r.records[0].data.cookies, '');
  assert.ok(r.records[0].warnings.some((w) => w.code === 'INVALID_JSON_CELL'));
  assert.equal(r.records[1].data.cookies, cookie('00040002').replace('},', '},\n'));
  assert.ok(!JSON.stringify(r.diagnostics).includes('FAKE_BROKEN'));
});
test('opaque values, ambiguous passwords and dates without context are not invented', async () => {
  const r = (await read('opaque-long-value-1234567890|FAKE_PASSWORD|5.10.1984|unlabelled value'))
    .records[0];
  assert.equal(r.data.token, '');
  assert.equal(r.data.password, '');
  assert.equal(r.data.birthDate, '');
  assert.equal(r.extraFields.length, 4);
});
test('row-specific assignment preserves original value and does not move adjacent fields', async () => {
  const text = formatB('00050001') + '\n' + formatB('00050002');
  const first = await read(text);
  const column = first.records[1].extraFields.find(
    (e) => e.value === 'FAKE_UNASSIGNED_PASSWORD'
  ).column;
  const changed = await read(text, { recordMapping: { 2: { [column]: 'emailPassword' } } });
  assert.equal(changed.records[0].data.emailPassword, '');
  assert.equal(changed.records[1].data.emailPassword, 'FAKE_UNASSIGNED_PASSWORD');
  assert.equal(changed.records[1].data.password, '');
  assert.equal(changed.records[1].sourceRecord, first.records[1].sourceRecord);
  assert.equal(changed.records[1].data.cookies, cookie('00050002'));
});
test('two-factor and mail-service URLs are metadata, never login codes or network actions', async () => {
  const r = (
    await read(
      'id:00060001::2fa:https://example.test/2fa/FAKE::mailService:https://example.test/mail::avatar:javascript:alert(1)::GEO GB'
    )
  ).records[0];
  assert.equal(r.extended.twoFactorUrl, 'https://example.test/2fa/FAKE');
  assert.equal(r.extended.mailServiceUrl, 'https://example.test/mail');
  assert.equal(r.extended.avatarUrl, '');
  assert.ok(r.warnings.some((w) => w.code === 'INVALID_FIELD'));
});
test('quoted secret payload and URL semicolons are not field separators', async () => {
  const text =
    'id:00070001::password:" FAKE|;::secret "::mailService:https://example.test/a;b?q=1::GEO GB';
  const r = (await read(text)).records[0];
  assert.equal(r.data.password, ' FAKE|;::secret ');
  assert.equal(r.extended.mailServiceUrl, 'https://example.test/a;b?q=1');
  assert.equal(r.sourceRecord, text);
});
test('ambiguous profile query identity never becomes an account ID', async () => {
  const r = (await read('https://facebook.com/profile.php?id=00080001&id=00080002|GEO GB'))
    .records[0];
  assert.equal(r.data.accountId, '');
  assert.ok(r.warnings.some((w) => w.code === 'IDENTITY_CONFLICT'));
});
test('legacy CSV and JSON rows expose exact original record spans', async () => {
  const { parseInput } = await import('../../shared/importer.mjs');
  for (const [name, text, expected] of [
    ['x.csv', 'id,email\r\n0009,"unicode@example.test"', '0009,"unicode@example.test"'],
    [
      'x.json',
      '[ { "id" : "0009", "email": "unicode@example.test" } ]',
      '{ "id" : "0009", "email": "unicode@example.test" }'
    ]
  ]) {
    const p = await parseInput(
      { bytes: Buffer.from(text), originalName: name },
      { classification: true }
    );
    assert.equal(p.records[0].sourceRecord, expected);
    assert.equal(text.slice(p.records[0].range.start, p.records[0].range.end), expected);
  }
});
test('structured parser bounds excessive nesting and fields without echoing values', async () => {
  await assert.rejects(
    read('id:00090001::' + '['.repeat(70) + '0' + ']'.repeat(70)),
    (e) => e.code === 'JSON_TOO_DEEP'
  );
  await assert.rejects(
    read('id:00090001::' + Array(600).fill('FAKE_VALUE').join('::')),
    (e) => e.code === 'TOO_MANY_FIELDS'
  );
});

test('same-line records ending in cookie JSON retain separate identities and exact cookie payloads', async () => {
  const variants = [
    (id) => `[{"name":"c_user","value":"${id}"}]`,
    (id) => `[{"value":"${id}","name":"c_user"}]`,
    (id) => `{"c_user":"${id}","xs":"FAKE_ONLY"}`
  ];
  for (const payload of variants)
    for (const label of ['', 'cookies:', 'cookie_json:'])
      for (const separator of ['; ', ' | ', '::']) {
        const ids = ['00020001', '00020002'],
          text = ids
            .map((id) => `id:${id}::name:Synthetic Person::${label}${payload(id)}`)
            .join(separator);
        const r = await read(text);
        assert.equal(r.records.length, 2, `${label}/${separator}/${text}`);
        for (const [i, row] of r.records.entries()) {
          assert.equal(row.data.accountId, ids[i]);
          assert.equal(row.data.cookies, payload(ids[i]));
          assert.equal(row.sourceRecord, text.slice(row.range.start, row.range.end));
        }
      }
});
