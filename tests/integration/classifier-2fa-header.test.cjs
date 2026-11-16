const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
for (const format of ['csv', 'json'])
  test(`TZ11 ${format} 2FA headers preserve codes separately from links and prevent raw archive disclosure`, async (t) => {
    const f = await fixture(t),
      svc = f.classification;
    for (const value of ['SYNTHETIC_CODE_ONLY', 'https://example.test/two-factor']) {
      const input =
        format === 'csv'
          ? `id,2fa\n10001,${value}`
          : JSON.stringify([{ id: '10001', '2fa': value }]);
      const r = await svc.read({
        bytes: Buffer.from(input),
        originalName: `synthetic.${format}`,
        requestId: format + value
      });
      const key = value.startsWith('https:') ? 'twoFactorUrl' : 'twoFactorCode';
      assert.equal(svc.cell(r.operationId, '1', key), value);
      assert.equal(svc.sourceText(r.operationId), input);
      svc.confirmClassification(
        r.operationId,
        r.status === 'preview_complete' ? 'accept_complete' : 'accept_partial'
      );
      const archives = createArchiveService(f);
      if (key === 'twoFactorCode')
        await assert.rejects(
          archives.saveArchive(r.operationId, { includeOriginal: true }),
          /ARCHIVE_2FA_ORIGINAL_NOT_ALLOWED/
        );
      else
        assert.ok((await archives.saveArchive(r.operationId, { includeOriginal: true })).archiveId);
    }
  });
