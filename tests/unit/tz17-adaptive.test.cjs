const { test } = require('node:test');
const assert = require('node:assert/strict');

async function scan(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: 'synthetic.txt' },
    { classification: true, ...options }
  );
  return { parsed, result: classifyRecords(parsed, options) };
}

const uid = '61500000123456';

test('TZ17 two unlabelled emails survive even when birth date and name are absent', async () => {
  const { parsed, result } = await scan(
    ['secondary@example.test', uid, 'primary@example.test', 'unrelated note'].join(';')
  );
  assert.equal(parsed.structured, true);
  assert.equal(result.records.length, 1);
  const row = result.records[0];
  assert.equal(row.data.email, 'secondary@example.test');
  assert.equal(row.data.backupEmail, 'primary@example.test');
  assert.equal(row.data.cookies, '');
  assert.ok(row.warnings.some((warning) => warning.code === 'SECOND_EMAIL_SAME_RECORD'));
});

test('TZ17 repeated explicit Email labels retain both distinct addresses', async () => {
  const text = [
    'Email:first@example.test',
    'Email:second@example.test',
    'Password:DemoFB123',
    'Email Password:DemoMail456',
    'ID Account:' + uid
  ].join('|');
  const { result } = await scan(text);
  assert.equal(result.records.length, 1);
  const row = result.records[0];
  assert.equal(row.data.email, 'first@example.test');
  assert.equal(row.data.backupEmail, 'second@example.test');
  assert.equal(row.data.password, 'DemoFB123');
  assert.equal(row.data.emailPassword, 'DemoMail456');
});

test('TZ17 tab-labelled duplicate Email fields preserve both', async () => {
  const text = [
    'Email\tfirst@example.test',
    'Email\tsecond@example.test',
    'Password\tDemoFB123',
    'Email Password\tDemoMail456',
    'ID\t' + uid
  ].join('\n');
  const { result } = await scan(text);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.email, 'first@example.test');
  assert.equal(result.records[0].data.backupEmail, 'second@example.test');
});

test('TZ17 mail-password shape can precede the email in an anchored record', async () => {
  const text = [
    'Mailsecret!4567',
    'FbSample123',
    'Desi Sample',
    uid,
    'one@example.test',
    '1.11.1998',
    'GEO Spain'
  ].join(';');
  const { result } = await scan(text);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].data.password, 'FbSample123');
  assert.equal(result.records[0].data.emailPassword, 'Mailsecret!4567');
  assert.equal(result.records[0].data.cookies, '');
});

test('TZ17 labelled permutations keep two emails and optional cookies without shifting roles', async () => {
  const base = [
    'Email:main@example.test',
    'BackupEmail:second@example.test',
    'Password:DemoFB123',
    'Email Password:DemoMail456',
    'ID:' + uid
  ];
  const cookie = 'Cookie:' + JSON.stringify([{ name: 'c_user', value: uid }]);
  for (const delimiter of [';', '|', '::']) {
    for (const withCookie of [false, true]) {
      const fields = [base[3], base[1], base[4], base[0], ...(withCookie ? [cookie] : []), base[2]];
      const original = fields.join(delimiter);
      const { result } = await scan(original);
      assert.equal(result.records.length, 1, delimiter);
      const row = result.records[0];
      assert.equal(row.data.password, 'DemoFB123', delimiter);
      assert.equal(row.data.emailPassword, 'DemoMail456', delimiter);
      assert.equal(row.data.email, 'main@example.test', delimiter);
      assert.equal(row.data.backupEmail, 'second@example.test', delimiter);
      assert.equal(Boolean(row.data.cookies), withCookie, delimiter);
      assert.equal(row.sourceRecord, original);
    }
  }
});

test('TZ17 arbitrary unmatched secrets remain reviewable instead of being swapped', async () => {
  const text = [
    'unknownA123',
    uid,
    'mail@example.test',
    'unknownB456',
    'Desi Sample',
    '1.11.1998'
  ].join(';');
  const { result } = await scan(text);
  const row = result.records[0];
  assert.equal(row.data.password, '');
  assert.equal(row.data.emailPassword, '');
  assert.ok(row.unrecognized.some((entry) => entry.value === 'unknownA123'));
  assert.ok(row.unrecognized.some((entry) => entry.value === 'unknownB456'));
});
