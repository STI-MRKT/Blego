const { test } = require('node:test');
const assert = require('node:assert/strict');

async function classify(text, name = 'synthetic.txt', options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  const parsed = await parseInput(
    { bytes: Buffer.from(text, 'utf8'), originalName: name },
    { classification: true, ...options }
  );
  return classifyRecords(parsed, options).records[0];
}

test('explicit FB and email password labels remain separate; French GEO comes from a uniquely named source file', async () => {
  const text = [
    'Login FB', '000100013',
    'FB password', 'FAKE_ACCOUNT_SECRET',
    'Email', 'synthetic@example.test',
    'Password Email', 'FAKE_MAIL_SECRET',
    'ID Account', 'https://www.facebook.com/profile.php?id=000100013',
    'Cookie', '[{"name":"c_user","value":"000100013"}]'
  ].join('\t');
  const record = await classify(text, '3748850_Акки_Facebook_Франция_для_рекламы.txt');
  assert.equal(record.data.password, 'FAKE_ACCOUNT_SECRET');
  assert.equal(record.data.emailPassword, 'FAKE_MAIL_SECRET');
  assert.equal(record.data.geo, 'FR');
  assert.deepEqual(record.fieldSources.geo, [
    { column: '__filename__', range: null, method: 'filename-hint' }
  ]);
  assert.ok(record.warnings.some(w => w.code === 'GEO_FROM_FILENAME'));
  assert.equal(record.sourceRecord, text);
});

test('explicit GEO overrides the source filename even when the countries disagree', async () => {
  const text = 'ID Account\t000100013\nGeo\tDE\nPassword\tFAKE_ACCOUNT_SECRET';
  const record = await classify(text, 'France_accounts.txt');
  assert.equal(record.data.geo, 'DE');
  assert.equal(record.data.password, 'FAKE_ACCOUNT_SECRET');
  assert.ok(!record.warnings.some(w => w.code === 'GEO_FROM_FILENAME'));
});

test('ambiguous or countryless source names do not invent GEO', async () => {
  const text = 'ID Account\t000100013\nPassword\tFAKE_ACCOUNT_SECRET';
  for (const name of ['France_Germany_accounts.txt', 'accounts_without_country.txt']) {
    const record = await classify(text, name);
    assert.equal(record.data.geo, '');
    assert.ok(!record.warnings.some(w => w.code === 'GEO_FROM_FILENAME'));
  }
});

test('opaque unlabelled passwords remain reviewable until an explicit mapping is supplied', async () => {
  const text = 'id=000100013|FAKE_ACCOUNT_SECRET|email=synthetic@example.test|FAKE_MAIL_SECRET|geo=FR';
  const result = await classify(text, 'synthetic.txt');
  assert.equal(result.data.password, '');
  assert.equal(result.data.emailPassword, '');
  assert.ok(result.unrecognized.some(e => e.value === 'FAKE_ACCOUNT_SECRET'));
  assert.ok(result.unrecognized.some(e => e.value === 'FAKE_MAIL_SECRET'));
  const mapped = await classify(text, 'synthetic.txt', {
    mapping: { column_2: 'password', column_4: 'emailPassword' }
  });
  assert.equal(mapped.data.password, 'FAKE_ACCOUNT_SECRET');
  assert.equal(mapped.data.emailPassword, 'FAKE_MAIL_SECRET');
  assert.equal(mapped.data.geo, 'FR');
});
