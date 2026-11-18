const { test } = require('node:test');
const assert = require('node:assert/strict');

async function scan(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic-order.txt' },
    { classification: true, ...options }
  );
  return { parsed, result: classifyRecords(parsed, options) };
}

const cookie = (uid) =>
  JSON.stringify([
    { domain: '.facebook.com', name: 'c_user', value: uid },
    { domain: '.facebook.com', name: 'xs', value: 'SYNTHETIC' }
  ]);
const agent = 'Mozilla/5.0 (X11; Linux x86_64; rv:122.0)';
const row = (mail, pass, id) => [mail, pass, id, cookie(id), agent].join(':');
const receipt = [
  'Номер заказа: 000001',
  'Наименование: Тестовый заказ, это не строка аккаунта',
  '================================================',
  'Формат выдачи:',
  'Товары выдаются в одну строку, разделители: : ; |',
  'К примеру: “Логин:Пароль” — это инструкция, не запись',
  '================================================',
  'Ваш заказ:'
].join('\n');

test('TZ20 only payload is classified after an explicit order envelope', async () => {
  const a = row('first@example.test', 'SYNTHETIC_FB_1', '61500000123456');
  const b = row('second@example.test', 'SYNTHETIC_FB_2', '61500000123457');
  const source = [receipt, a, b].join('\n');
  const { parsed, result } = await scan(source, {
    headers: false,
    columnOrder: 'Email|Пароль|Fb_ID|Cookie|User-Agent'
  });
  assert.equal(parsed.text, source, 'retain source text for exact spans');
  assert.equal(parsed.records.length, 2, 'order header and instruction are not account records');
  assert.deepEqual(
    parsed.records.map((r) => r.sourceRecord),
    [a, b]
  );
  assert.deepEqual(
    result.records.map((r) => r.data.password),
    ['SYNTHETIC_FB_1', 'SYNTHETIC_FB_2']
  );
  assert.deepEqual(
    result.records.map((r) => r.data.accountId),
    ['61500000123456', '61500000123457']
  );
  assert.equal(result.records[0].data.cookies, cookie('61500000123456'));
  assert.equal(result.records[0].data.userAgent, agent);
});

test('TZ20 colon tuple with nested Cookie and UA punctuation does not split inside composites', async () => {
  const a = row('first@example.test', 'SYNTHETIC_FB_1', '61500000123456');
  const { parsed } = await scan([receipt, a].join('\n'), { headers: false });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].sourceEntries.length, 5);
  assert.equal(parsed.records[0].sourceEntries[3].value, cookie('61500000123456'));
  assert.equal(parsed.records[0].sourceEntries[4].value, agent);
});

test('TZ20 explicit order footer is ignored without losing preceding records', async () => {
  const a = row('first@example.test', 'SYNTHETIC_FB_1', '61500000123456');
  const text = [receipt, a, '--------------------', 'Специальное предложение после заказа'].join(
    '\n'
  );
  const { parsed } = await scan(text, { headers: false });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].sourceRecord, a);
  assert.equal(parsed.text, text);
});

test('TZ20 ordinary already supported labelled TXT is not rewritten', async () => {
  const text = [
    'ID:61500000123456',
    'Password:SYNTHETIC_PASSWORD',
    'Email:first@example.test'
  ].join('|');
  const { parsed, result } = await scan(text);
  assert.equal(parsed.records.length, 1);
  assert.equal(result.records[0].data.password, 'SYNTHETIC_PASSWORD');
  assert.equal(result.records[0].data.accountId, '61500000123456');
  assert.equal(parsed.records[0].sourceRecord, text);
});

test('TZ20 colon account can span blank lines before Cookie JSON', async () => {
  const a = [
    'split@example.test:SYNTHETIC_FB_SPLIT:61500000123456:',
    '',
    '',
    cookie('61500000123456') + ':' + agent
  ].join('\n');
  const source = [receipt, a, row('second@example.test', 'SYNTHETIC_FB_2', '61500000123457')].join('\n');
  const { parsed, result } = await scan(source, {
    headers: false,
    columnOrder: 'Email|Пароль|Fb_ID|Cookie|User-Agent'
  });
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].sourceRecord, a);
  assert.equal(result.records[0].data.password, 'SYNTHETIC_FB_SPLIT');
  assert.equal(result.records[0].data.cookies, cookie('61500000123456'));
});

test('TZ20 standalone order number is not an account in short two-email rows', async () => {
  const a = [
    'first@example.test',
    'SYNTHETIC_FB_1',
    'mail@example.test',
    'SYNTHETIC_MAIL_1',
    'AAAA BBBB CCCC DDDD',
    'https://www.facebook.com/profile.php?id=61500000123456'
  ].join(';');
  const b = a.replaceAll('61500000123456', '61500000123457');
  const source = ['Номер заказа: 000001', '', a, b].join('\n');
  const { parsed } = await scan(source, { headers: false });
  assert.equal(parsed.records.length, 2);
  assert.deepEqual(parsed.records.map((item) => item.sourceRecord), [a, b]);
});

test('TZ20 multiline vertical credentials form records, not one row per field', async () => {
  const group = (uid, first, backup, fb, mail) => [
    first,
    '',
    fb + ';',
    '',
    backup,
    mail + ';',
    '',
    'AAAA BBBB CCCC DDDD;',
    '',
    uid
  ].join('\n');
  const a = group('61500000123456', 'one@example.test', 'backup@example.test', 'SYNTH_FB_1', 'SYNTH_MAIL_1');
  const b = group('61500000123457', 'two@example.test', 'other@example.test', 'SYNTH_FB_2', 'SYNTH_MAIL_2');
  const text = a + '\n\n\n' + b;
  const { parsed, result } = await scan(text, {
    headers: false,
    columnOrder: 'Email|Пароль|BackupEmail|EmailPassword|Дополнительное поле|Fb_ID'
  });
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].sourceRecord, a);
  assert.equal(result.records[0].data.password, 'SYNTH_FB_1');
  assert.equal(result.records[0].data.emailPassword, 'SYNTH_MAIL_1');
  assert.equal(result.records[1].data.accountId, '61500000123457');
});

test('TZ20 uniquely anchored account colon layout infers one FB password without supplied order', async () => {
  const a = row('first@example.test', 'SYNTHETIC_FB_1', '61500000123456');
  const { result } = await scan([receipt, a].join('\n'), { headers: false });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.password, 'SYNTHETIC_FB_1');
  assert.equal(result.records[0].data.accountId, '61500000123456');
  assert.ok(result.records[0].warnings.some((warning) => warning.code === 'CREDENTIAL_LAYOUT_INFERRED'));
});

test('TZ20 conflicting Cookie owner does not infer an account password', async () => {
  const a = [
    'first@example.test',
    'SYNTHETIC_FB_1',
    '61500000123456',
    cookie('61500000999999'),
    agent
  ].join(':');
  const { result } = await scan([receipt, a].join('\n'), { headers: false });
  assert.equal(result.records[0].data.password, '');
});

test('TZ20 compound double-colon row keeps Cookie JSON, UA and source intact', async () => {
  const uid = '61500000123456';
  const compound = [
    'first@example.test',
    'EAAB_SYNTHETIC_ACCESS_TOKEN',
    agent,
    '',
    cookie(uid),
    'SYNTHETIC_FB_1',
    'backup@example.test;SYNTHETIC_MAIL_1;1998-01-02;' + uid + ';Example Person;GEO Spain'
  ].join(' :: ');
  const source = [receipt, compound].join('\n');
  const { parsed } = await scan(source, { headers: false });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].sourceRecord, compound);
  assert.ok(parsed.records[0].sourceEntries.some((entry) => entry.value === cookie(uid)));
  assert.ok(parsed.records[0].sourceEntries.some((entry) => entry.value === agent));
});

test('TZ20 two-email semicolon rows remain separate and preserve raw values', async () => {
  const make = (uid, first, backup) =>
    [first, 'SYNTHETIC_FB_1', backup, 'SYNTHETIC_MAIL_1',
      'AAAA BBBB CCCC DDDD', 'https://www.facebook.com/profile.php?id=' + uid].join(';');
  const a = make('61500000123456', 'first@example.test', 'backup@example.test');
  const b = make('61500000123457', 'second@example.test', 'other@example.test');
  const source = ['Номер заказа: 000001', '', a, b].join('\n');
  const { parsed } = await scan(source, { headers: false });
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].sourceEntries.length, 6);
  assert.deepEqual(parsed.records.map((r) => r.sourceRecord), [a, b]);
});
