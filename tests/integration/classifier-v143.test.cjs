const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
const { cases } = require('../fixtures/classifier-v143.cjs');
test('TZ11 worker recognizes all labelled formats and keeps exact source, core7 and 2FA privacy', async (t) => {
  const f = await fixture(t),
    svc = f.classification;
  for (const [index, example] of cases.entries()) {
    const result = await svc.read(
      {
        bytes: Buffer.from(example.text),
        originalName: 'synthetic.txt',
        requestId: 'v143-' + index
      },
      example.options
    );
    assert.equal(svc.sourceText(result.operationId), example.text);
    for (const [i, expected] of example.expected.entries())
      for (const [key, value] of Object.entries(expected))
        assert.equal(svc.cell(result.operationId, String(i + 1), key), value);
    const exported = await svc.exportText(result.operationId);
    assert.equal(exported.split('\n')[0].split('\t').length, 7);
    assert.ok(!exported.includes('SYNTHETIC_2FA'));
    svc.cancel(result.operationId);
  }
  const input = 'id=10001:email=one@example.test:twoFactorCode=SYNTHETIC_PRIVATE_2FA';
  const result = await svc.read({
    bytes: Buffer.from(input),
    originalName: 'synthetic.txt',
    requestId: 'archive-private'
  });
  svc.confirmClassification(
    result.operationId,
    result.status === 'preview_complete' ? 'accept_complete' : 'accept_partial'
  );
  const archives = createArchiveService(f);
  await assert.rejects(
    archives.saveArchive(result.operationId, { includeOriginal: true }),
    /ARCHIVE_2FA_ORIGINAL_NOT_ALLOWED/
  );
  const saved = await archives.saveArchive(result.operationId);
  const opened = await archives.openArchive(saved.archiveId);
  for (const value of Object.values(opened.entries))
    assert.ok(!value.toString().includes('SYNTHETIC_PRIVATE_2FA'));
  assert.equal(svc.cell(result.operationId, '1', 'twoFactorCode'), 'SYNTHETIC_PRIVATE_2FA');
  assert.equal(svc.sourceText(result.operationId), input);
});
