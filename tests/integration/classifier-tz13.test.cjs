const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
const { fields, pairs, block } = require('../fixtures/classifier-tz13.cjs');

function input(format) {
  if (format === 'txt') return block;
  if (format === 'json') return JSON.stringify([Object.fromEntries(pairs)]);
  const delimiter = format === 'csv' ? ',' : '\t';
  const cell = (value) =>
    /[",\t\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  return (
    pairs.map(([label]) => cell(label)).join(delimiter) +
    '\n' +
    pairs.map(([, value]) => cell(value)).join(delimiter)
  );
}
test('TZ13 worker preserves TXT/CSV/TSV/JSON cells, row/table export and core7 archives', async (t) => {
  const f = await fixture(t),
    svc = f.classification;
  const { parseText } = await import('../../shared/importer.mjs');
  const expectedCore = [
    '',
    "'" + fields.accountId,
    fields.password,
    fields.emailPassword,
    fields.email,
    fields.birthDate,
    ''
  ];
  for (const format of ['txt', 'csv', 'tsv', 'json']) {
    const text = input(format);
    const result = await svc.read({
      bytes: Buffer.from(text),
      originalName: `synthetic.${format}`,
      requestId: format
    });
    assert.equal(svc.page(result.operationId).records.length, 1);
    for (const [field, expected] of Object.entries(fields))
      assert.equal(svc.cell(result.operationId, '1', field), expected, `${format}:${field}`);
    assert.equal(svc.sourceText(result.operationId), text);
    for (const outFormat of ['tsv', 'csv']) {
      const row = await svc.exportText(result.operationId, { recordId: '1', format: outFormat });
      assert.equal(row, await svc.exportText(result.operationId, { format: outFormat }));
      const parsed = parseText(row, outFormat);
      assert.equal(parsed.columns.length, 7);
      assert.deepEqual(parsed.records[0].raw, expectedCore);
      for (const field of ['token', 'cookies', 'userAgent'])
        assert.ok(!row.includes(fields[field]));
    }
    svc.confirmClassification(
      result.operationId,
      result.status === 'preview_complete' ? 'accept_complete' : 'accept_partial'
    );
    const archives = createArchiveService(f);
    const saved = await archives.saveArchive(result.operationId);
    const opened = await archives.openArchive(saved.archiveId);
    const resultText =
      opened.entries['result.tsv']?.toString() ||
      Object.entries(opened.entries)
        .find(([name]) => name.startsWith('result.'))?.[1]
        .toString();
    assert.ok(resultText);
    assert.deepEqual(parseText(resultText, 'tsv').records[0].raw, expectedCore);
    for (const field of ['token', 'cookies', 'userAgent'])
      assert.ok(
        !Object.values(opened.entries).some((bytes) => bytes.toString().includes(fields[field]))
      );
    svc.cancel(result.operationId);
  }
});

test('TZ13 tab Cookie copy is exact and manual overrides retain confidential 2FA source protection', async (t) => {
  const f = await fixture(t),
    svc = f.classification;
  const cookie =
    '[\n\t{"name":"c_user","value":"000100013"},\n\t{"name":"xs","value":"SYNTHETIC:;|\\\"quote\\\""}\n]';
  const text = `Login FB\tsynthetic.one\nID Account\t000100013\nCookie\t${cookie}\nPassword\t2fa=SYNTHETIC_LITERAL_PASSWORD\nEmail\tone@example.test\n2FA\tSYNTHETIC_PRIVATE_CODE`;
  const result = await svc.read({
    bytes: Buffer.from(text),
    originalName: 'synthetic.txt',
    requestId: 'cookie-and-privacy'
  });
  assert.equal(svc.cell(result.operationId, '1', 'cookies'), cookie);
  assert.equal(svc.cell(result.operationId, '1', 'password'), '2fa=SYNTHETIC_LITERAL_PASSWORD');
  assert.equal(svc.cell(result.operationId, '1', 'twoFactorCode'), 'SYNTHETIC_PRIVATE_CODE');
  await assert.rejects(
    svc.reclassify(result.operationId, { mapping: { '2FA': 'password' } }),
    /CONFIDENTIAL_FIELD_MAPPING/
  );
  const remapped = await svc.reclassify(result.operationId, {
    mapping: { Email: 'emailPassword' }
  });
  assert.equal(svc.cell(result.operationId, '1', 'emailPassword'), 'one@example.test');
  assert.equal(svc.cell(result.operationId, '1', 'email'), '');
  assert.equal(svc.sourceText(result.operationId), text);
  svc.confirmClassification(
    result.operationId,
    remapped.status === 'preview_complete' ? 'accept_complete' : 'accept_partial'
  );
  const archives = createArchiveService(f);
  await assert.rejects(
    archives.saveArchive(result.operationId, { includeOriginal: true }),
    /ARCHIVE_2FA_ORIGINAL_NOT_ALLOWED/
  );
  const saved = await archives.saveArchive(result.operationId),
    opened = await archives.openArchive(saved.archiveId);
  assert.ok(
    !Object.values(opened.entries).some((bytes) =>
      bytes.toString().includes('SYNTHETIC_PRIVATE_CODE')
    )
  );
});

test('TZ13 worker copies a one-line Facebook label record with an unpaired instruction', async (t) => {
  const f = await fixture(t),
    svc = f.classification;
  const profileUrl = 'https://www.facebook.com/profile.php?id=61500000000000';
  const text = [
    'Login FB',
    '61500000000000',
    'Password',
    'FAKEPASS01',
    'Email',
    'demo.fr@example.invalid',
    'Email password',
    'FAKEMAILPASS1',
    'ID Account',
    profileUrl,
    'Date of Birth',
    '01.02.1994',
    'Token',
    'EAAB_FAKE_TEST_ONLY',
    'ИНСТРУКЦИЯ В ТЕЛЕГРАМ БОТЕ / INSTRUCTIONS - @example_bot',
    'User-agent',
    'Mozilla/5.0 (Synthetic Test)',
    'Cookie',
    '[{"name":"c_user","value":"61500000000000"}]'
  ].join('\t');
  const result = await svc.read({
    bytes: Buffer.from(text),
    originalName: 'synthetic.txt',
    requestId: 'one-line-instruction'
  });
  assert.equal(svc.page(result.operationId).records.length, 1);
  assert.equal(svc.cell(result.operationId, '1', 'password'), 'FAKEPASS01');
  assert.equal(svc.cell(result.operationId, '1', 'emailPassword'), 'FAKEMAILPASS1');
  assert.equal(svc.cell(result.operationId, '1', 'accountId'), '61500000000000');
  assert.equal(svc.sourceText(result.operationId), text);
  const row = await svc.exportText(result.operationId, { recordId: '1', format: 'tsv' });
  const { parseText } = await import('../../shared/importer.mjs');
  assert.deepEqual(parseText(row, 'tsv').records[0].raw.slice(1, 6), [
    "'61500000000000",
    'FAKEPASS01',
    'FAKEMAILPASS1',
    'demo.fr@example.invalid',
    '01.02.1994'
  ]);
});
