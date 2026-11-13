const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');
const { formatA, formatB, cookie } = require('../fixtures/classifier-v14.cjs');
const input = (text, requestId = 'v14') => ({
  bytes: Buffer.from(text),
  originalName: 'synthetic.txt',
  requestId
});
test('worker handles 1/10/100/1000 mixed records and exact cookie after sorted paging', async (t) => {
  const service = createClassificationService();
  t.after(() => service.close());
  for (const count of [1, 10, 100, 1000]) {
    const text = Array.from({ length: count }, (_, i) =>
      (i % 2 ? formatB : formatA)('000' + (100000 + i))
    ).join('\n');
    const result = await service.read(input(text, 'v14-' + count));
    assert.equal(result.counts.total, count);
    const page = service.page(result.operationId, 0, { sort: 'rowNumber', descending: true });
    assert.equal(page.records[0].recordId, String(count));
    const expected = cookie('000' + (100000 + count - 1));
    assert.equal(
      service.cell(result.operationId, String(count), 'cookies'),
      (count - 1) % 2 ? expected : expected.replace('},', '},\n')
    );
    service.cancel(result.operationId);
  }
});
test('per-record reclassification and warnings-only filter preserve source and seven-field export', async (t) => {
  const service = createClassificationService();
  t.after(() => service.close());
  const text = formatA('00011001') + '\n' + formatB('00011002');
  const result = await service.read(input(text));
  const all = service.page(result.operationId);
  const column = all.records[1].extraFields.find(
    (e) => e.value === 'FAKE_UNASSIGNED_PASSWORD'
  ).column;
  assert.equal(service.page(result.operationId, 0, { warningsOnly: true }).filteredTotal, 1);
  await service.reclassify(result.operationId, { recordMapping: { 2: { [column]: 'password' } } });
  assert.equal(service.cell(result.operationId, '2', 'password'), 'FAKE_UNASSIGNED_PASSWORD');
  assert.equal(service.page(result.operationId).records[1].sourceRecord, formatB('00011002'));
  const exported = await service.exportText(result.operationId);
  assert.ok(!exported.includes('FAKE_OPAQUE_TOKEN'));
  assert.ok(!exported.includes('c_user'));
  assert.ok(!exported.includes('Mozilla/'));
  assert.equal(exported.split('\n')[0].split('\t').length, 7);
  assert.equal(service.sourceText(result.operationId), text);
});
test('contradictory identity requires review and source input remains bounded', async (t) => {
  const service = createClassificationService();
  t.after(() => service.close());
  const result = await service.read(
    input('https://facebook.com/profile.php?id=00012001|' + cookie('00012002'))
  );
  assert.equal(result.status, 'preview_partial');
  assert.equal(service.page(result.operationId, 0, { warningsOnly: true }).filteredTotal, 1);
  await assert.rejects(
    service.read({
      requestId: 'too-big',
      originalName: 'synthetic.txt',
      bytes: new Uint8Array(50 * 1024 * 1024 + 1)
    }),
    /INVALID_INPUT/
  );
  await assert.rejects(
    service.reclassify(result.operationId, { recordMapping: { 999: { column_1: 'password' } } }),
    /INVALID_MAPPING/
  );
});
