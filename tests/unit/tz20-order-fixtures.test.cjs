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
  assert.deepEqual(parsed.records.map((r) => r.sourceRecord), [a, b]);
  assert.deepEqual(result.records.map((r) => r.data.password), [
    'SYNTHETIC_FB_1',
    'SYNTHETIC_FB_2'
  ]);
  assert.deepEqual(result.records.map((r) => r.data.accountId), [
    '61500000123456',
    '61500000123457'
  ]);
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
  const text = [receipt, a, '--------------------', 'Специальное предложение после заказа'].join('\n');
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
