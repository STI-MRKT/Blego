const { test } = require('node:test');
const assert = require('node:assert/strict');

test('TZ17 shows undefined passwords explicitly and disables empty-value copy', async () => {
  const { state } = await import('../../src/js/state.js');
  const { importHTML } = await import('../../src/js/ui/import.js');
  const original = {
    importData: state.importData,
    importStep: state.importStep,
    classifierDetailRow: state.classifierDetailRow
  };
  try {
    state.importStep = 'preview';
    state.classifierDetailRow = null;
    state.importData = {
      status: 'preview_partial',
      counts: { total: 1 },
      records: [{
        id: '1',
        data: { rowNumber: '1', accountId: '61500000123456', email: 'one@example.test' },
        extended: {},
        warnings: []
      }],
      sourceColumns: [],
      offset: 0,
      filteredTotal: 1
    };
    const html = importHTML();
    assert.equal((html.match(/Не определён/g) || []).length, 2);
    assert.match(html, /aria-label="Копировать Пароль" disabled/);
    assert.match(html, /aria-label="Копировать Пароль от почты" disabled/);

    state.importData.records[0].data.password = 'SampleFb123';
    state.importData.records[0].data.emailPassword = 'SampleMail456';
    const recognized = importHTML();
    assert.match(recognized, /SampleFb123/);
    assert.match(recognized, /SampleMail456/);
    assert.doesNotMatch(recognized, /Не определён/);
  } finally {
    Object.assign(state, original);
  }
});
