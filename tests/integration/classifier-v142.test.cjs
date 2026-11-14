const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cases } = require('../fixtures/classifier-v142.cjs');
test('TZ9 worker keeps every labelled field and raw source through paging, copying and core7 export', async (t) => {
  const service =
    require('../../electron/features/classification/service.cjs').createClassificationService();
  t.after(() => service.close());
  for (const [n, fixture] of cases.entries()) {
    const result = await service.read({
      bytes: Buffer.from(fixture.text),
      originalName: 'synthetic.txt',
      requestId: `quality-${n}`
    });
    const page = service.page(result.operationId);
    assert.equal(page.records.length, fixture.expected.length);
    for (const [i, expected] of fixture.expected.entries()) {
      for (const [key, value] of Object.entries(expected))
        assert.equal(service.cell(result.operationId, String(i + 1), key), value);
      if (!expected.emailPassword)
        assert.equal(service.cell(result.operationId, String(i + 1), 'emailPassword'), '');
    }
    assert.equal(service.sourceText(result.operationId), fixture.text);
    assert.equal(
      (await service.exportText(result.operationId)).split('\n')[0].split('\t').length,
      7
    );
    service.cancel(result.operationId);
  }
});
