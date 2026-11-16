const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
test('review: 2FA source confidentiality survives remapping and schema removal without authorizing core or original export', async (t) => {
  const f = await fixture(t),
    s = f.classification;
  for (const kind of ['schema', 'csv', 'label']) {
    const text =
      kind === 'schema'
        ? 'sample_login:FAKE_ACCOUNT:one@example.test:FAKE_MAIL:SYNTHETIC_2FA:10001'
        : kind === 'csv'
          ? 'id,2fa\n10001,SYNTHETIC_2FA'
          : 'id=10001 | 2fa=SYNTHETIC_2FA';
    const options = kind === 'schema' ? { schema: 'credentials6' } : {};
    const r = await s.read(
      {
        bytes: Buffer.from(text),
        originalName: kind === 'csv' ? 'synthetic.csv' : 'synthetic.txt',
        requestId: kind
      },
      options
    );
    const column = kind === 'schema' ? 'column_5' : kind === 'csv' ? '2fa' : 'column_2';
    await assert.rejects(
      s.reclassify(r.operationId, { recordMapping: { 1: { [column]: 'password' } } }),
      /CONFIDENTIAL_FIELD_MAPPING/
    );
    assert.ok(!(await s.exportText(r.operationId)).includes('SYNTHETIC_2FA'));
    const remapped = await s.reclassify(r.operationId, {
      schema: null,
      recordMapping: { 1: { [column]: 'token' } }
    });
    s.confirmClassification(
      r.operationId,
      remapped.status === 'preview_complete' ? 'accept_complete' : 'accept_partial'
    );
    assert.equal(s.getConfirmed(r.operationId).containsTwoFactor, true);
    const archive = createArchiveService(f);
    await assert.rejects(
      archive.saveArchive(r.operationId, { includeOriginal: true }),
      /ARCHIVE_2FA_ORIGINAL_NOT_ALLOWED/
    );
    const saved = await archive.saveArchive(r.operationId),
      opened = await archive.openArchive(saved.archiveId);
    assert.ok(
      !JSON.stringify(Object.values(opened.entries).map((b) => b.toString())).includes(
        'SYNTHETIC_2FA'
      )
    );
    assert.equal(s.sourceText(r.operationId), text);
    s.cancel(r.operationId);
  }
});
