const { test } = require('node:test');
const assert = require('node:assert/strict');
const parse = async (text, name = 'synthetic.tsv', options = {}) => {
  const { parseInput } = await import('../../shared/importer.mjs');
  return parseInput(
    { bytes: Buffer.from(text), originalName: name },
    { classification: true, ...options }
  );
};
const classify = async (p, options) =>
  (await import('../../shared/classifier.mjs')).classifyRecords(p, options);

test('named fields preserve ID precision, cookie JSON representation and missing cells', async () => {
  const cookie =
    '[ { "name": "c_user", "value": "FAKE_COOKIE_OTHER" }, {"name":"fake","value":"FAKE_COOKIE_\\\"|;"} ]';
  const p = await parse(
    `ФИО\tID\tПароль\tПароль от почты\tПочта\tКуки\nExample Person\t0009007199254740993123\tFAKE_PASS\t\ttest@example.com\t${cookie}\nSecond Person\t002\t\tFAKE_MAIL_PASS\t\t`
  );
  assert.equal(p.records.length, 2);
  const c = await classify(p);
  assert.equal(c.records[0].data.accountId, '0009007199254740993123');
  assert.equal(c.records[0].data.cookies, cookie);
  assert.equal(c.records[0].data.emailPassword, '');
  assert.equal(c.records[1].data.password, '');
  assert.equal(c.records[1].data.emailPassword, 'FAKE_MAIL_PASS');
  assert.ok(c.diagnostics.some((d) => d.code === 'COOKIE_ID_CONFLICT' && d.recordId === '1'));
});
test('explicit headerless schemas retain first row and empty positions, never guessed by count', async () => {
  const text =
    'Example One\t0001\tFAKE_PASS\t\tone@example.com\t01.02.2000\tGB\nExample Two\t0002\t\tFAKE_MAIL\t\t\tUS';
  const p = await parse(text, 'synthetic.tsv', { headers: false });
  assert.equal(p.records.length, 2);
  const c = await classify(p, { schema: 'core7' });
  assert.equal(c.records[0].data.fullName, 'Example One');
  assert.equal(c.records[1].data.email, '');
  const unknown = await classify(p);
  assert.equal(unknown.records[0].data.password, '');
  assert.equal(unknown.records[0].data.fullName, '');
});
test('JSON cookie objects keep original source slice and duplicate fields stay unresolved', async () => {
  const raw = '[ { "name" : "fake", "value" : "FAKE_COOKIE_\\u0061" } ]';
  const p = await parse(
    `[{"id":9007199254740993123,"cookies":${raw},"email":"one@example.com"},{"id":"0002","password":"FAKE_A","password":"FAKE_B"}]`,
    'synthetic.json'
  );
  const c = await classify(p);
  assert.equal(c.records[0].data.accountId, '9007199254740993123');
  assert.equal(c.records[0].data.cookies, raw);
  assert.equal(c.records[1].data.password, '');
  assert.ok(c.records[1].unrecognized.length);
});
test('multiline JSON and quoted CSV are logical cells; pipe and semicolon inside JSON are ignored', async () => {
  for (const delim of ['|', ';', '\t']) {
    const cookie = '[\n {"name":"fake","value":"FAKE_COOKIE_|;\\\"x"}\n]';
    const p = await parse(
      `id${delim}cookies\n0001${delim}${cookie}\n0002${delim}FAKE_COOKIE_2`,
      'synthetic.txt'
    );
    assert.equal(p.records.length, 2);
    assert.equal((await classify(p)).records[0].data.cookies, cookie);
  }
  const p = await parse('id,cookies\n0001,"[{""value"":""FAKE_COOKIE_x""},\n{}]"', 'synthetic.csv');
  assert.equal((await classify(p)).records[0].data.cookies, '[{"value":"FAKE_COOKIE_x"},\n{}]');
});
test('cautious heuristics reject ambiguity and impossible dates without inventing passwords or tokens', async () => {
  const p = await parse(
    'one@example.com\ttwo@example.com\tFAKE_TOKEN_LONG\tFAKE_PASS!\t31.02.2000\tGB\tMozilla/5.0 FAKE\nvalid@example.com\t\t\t\t2000-02-29\tUS\t',
    'synthetic.tsv',
    { headers: false }
  );
  const c = await classify(p);
  const a = c.records[0].data;
  assert.equal(a.email, '');
  assert.equal(a.password, '');
  assert.equal(a.emailPassword, '');
  assert.equal(a.token, '');
  assert.equal(a.birthDate, '');
  assert.equal(a.geo, 'GB');
  assert.equal(a.userAgent, 'Mozilla/5.0 FAKE');
  assert.equal(c.records[1].data.birthDate, '2000-02-29');
  assert.ok(c.records[0].unrecognized.length >= 5);
});
test('explicit mapping, alias collisions and invalid dates retain original unresolved values', async () => {
  const p = await parse('a\tb\nFAKE_LOGIN\tFAKE_EMAIL', 'synthetic.tsv', { headers: true });
  const c = await classify(p, { mapping: { a: 'password', b: 'emailPassword' } });
  assert.equal(c.records[0].data.password, 'FAKE_LOGIN');
  const bad = await classify(await parse('id\tID\tbirthDate\n0001\t0002\t31/02/2000'));
  assert.equal(bad.records[0].data.accountId, '');
  assert.equal(bad.records[0].data.birthDate, '');
  assert.equal(bad.records[0].unrecognized.length, 3);
});
