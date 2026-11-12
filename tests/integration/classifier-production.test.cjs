const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');
const input = (text, requestId = 'one') => ({
  bytes: Buffer.from(text),
  originalName: 'synthetic.tsv',
  requestId
});

test('production worker classifies 51 records, stable sorted paging and exact cookie lookup', async (t) => {
  const svc = createClassificationService();
  t.after(() => svc.close());
  const r = await svc.read(
    input(
      'id\tcookies\n' + Array.from({ length: 51 }, (_, i) => `00${i}\tFAKE_COOKIE_${i}`).join('\n')
    )
  );
  assert.equal(r.status, 'preview_complete');
  assert.equal(r.rulesVersion, 'synthetic-records-1');
  const p = svc.page(r.operationId, 0, { sort: 'rowNumber', descending: true });
  assert.equal(p.records.length, 50);
  assert.equal(p.records[0].recordId, '51');
  assert.equal(svc.cell(r.operationId, '51', 'cookies'), 'FAKE_COOKIE_50');
  assert.equal(svc.page(r.operationId, 50).records[0].data.accountId, '0050');
  assert.equal(svc.page(r.operationId, 0, { query: '0050' }).filteredTotal, 1);
  assert.throws(() => svc.cell(r.operationId, 'bad', 'cookies'));
  svc.cancel(r.operationId);
  assert.throws(() => svc.cell(r.operationId, '51', 'cookies'));
});
test('explicit remapping reuses operation and raw source; partial requires explicit confirmation', async (t) => {
  const svc = createClassificationService();
  t.after(() => svc.close());
  const r = await svc.read(input('FAKE_A\tFAKE_B'), { headers: false });
  assert.equal(r.status, 'preview_partial');
  assert.throws(() => svc.confirmClassification(r.operationId, 'accept_complete'));
  const mapped = await svc.reclassify(r.operationId, {
    mapping: { column_1: 'password', column_2: 'emailPassword' }
  });
  assert.equal(mapped.operationId, r.operationId);
  assert.equal(mapped.status, 'preview_complete');
  assert.equal(svc.page(r.operationId).records[0].data.emailPassword, 'FAKE_B');
  svc.confirmClassification(r.operationId, 'accept_complete');
  assert.equal(svc.getConfirmed(r.operationId).status, 'completed');
});
test('archive payload and diagnostics exclude raw cookies, token, UA and unresolved values', async (t) => {
  const svc = createClassificationService();
  t.after(() => svc.close());
  const r = await svc.read(
    input(
      'id\tcookies\ttoken\tuserAgent\textra\n0001\tFAKE_COOKIE_PRIVATE\tFAKE_TOKEN_PRIVATE\tFAKE_UA_PRIVATE\tFAKE_UNKNOWN_PRIVATE'
    )
  );
  svc.confirmClassification(r.operationId, 'accept_partial');
  const c = svc.getConfirmed(r.operationId);
  for (const v of [
    'FAKE_COOKIE_PRIVATE',
    'FAKE_TOKEN_PRIVATE',
    'FAKE_UA_PRIVATE',
    'FAKE_UNKNOWN_PRIVATE'
  ]) {
    assert.ok(!c.resultText.includes(v));
    assert.ok(!c.unresolvedText.includes(v));
    assert.ok(!JSON.stringify(c.diagnostics).includes(v));
  }
});
test('cancel during reclassification cannot resurrect discarded operation', async (t) => {
  const svc = createClassificationService();
  t.after(() => svc.close());
  const r = await svc.read(input('FAKE_A\tFAKE_B'), { headers: false });
  const pending = svc.reclassify(r.operationId, { schema: 'core7' });
  svc.cancel(r.operationId);
  await assert.rejects(pending, /CANCELLED/);
  assert.throws(() => svc.page(r.operationId));
});
