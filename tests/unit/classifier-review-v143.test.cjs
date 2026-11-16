const { test } = require('node:test'),
  assert = require('node:assert/strict');
async function classify(text, options = {}) {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { classifyRecords } = await import('../../shared/classifier.mjs');
  return classifyRecords(
    await parseInput(
      { bytes: Buffer.from(text), originalName: 'synthetic.txt' },
      { classification: true, ...options }
    ),
    options
  );
}
test('review: composite URLs and unframed password separators stay byte-exact', async () => {
  const url = 'https://example.test/path:password=SYNTHETIC';
  const a = await classify(`id=10001 | 2fa=${url} | email=one@example.test`);
  assert.equal(a.records[0].extended.twoFactorUrl, url);
  assert.equal(a.records[0].data.password, '');
  for (const password of ['FAKE/email=oops@example.test', 'FAKE\\\\email=oops@example.test']) {
    const b = await classify(`id=10001 | password=${password}`);
    assert.equal(b.records[0].data.password, password);
    assert.equal(b.records[0].data.email, '');
  }
});
test('review: confirmed colon records keep trailing empty fields and never consume the next account', async () => {
  const header = 'login:password:email:emailPassword:twoFactorCode:accountId\n';
  const text =
    'one:ONE_PASS:one@example.test:ONE_MAIL:ONE_2FA:\ntwo:TWO_PASS:two@example.test:TWO_MAIL:TWO_2FA:10002';
  for (const [prefix, options] of [
    [header, {}],
    ['', { schema: 'credentials6' }]
  ]) {
    const r = await classify(prefix + text, options);
    assert.equal(r.records.length, 2);
    assert.equal(r.records[0].data.accountId, '');
    assert.equal(r.records[0].extended.login, 'one');
    assert.equal(r.records[1].data.accountId, '10002');
    assert.equal(r.records[1].data.emailPassword, 'TWO_MAIL');
    assert.equal(r.records[0].sourceRecord, text.split('\n')[0]);
  }
});
