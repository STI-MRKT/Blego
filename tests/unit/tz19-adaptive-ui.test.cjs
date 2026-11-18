const { test } = require('node:test');
const assert = require('node:assert/strict');

test('TZ19 classifier exposes explicit pattern memory controls without storing source values in UI', async () => {
  const { state } = await import('../../src/js/state.js');
  const { importHTML } = await import('../../src/js/ui/import.js');
  const keys = [
    'importStep',
    'importData',
    'classifierOptions',
    'classifierSavedCount',
    'classifierDetailRow',
    'imagesBusy'
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, state[key]]));
  try {
    state.importStep = 'preview';
    state.importData = {
      operationId: 'synthetic-operation',
      status: 'preview_partial',
      counts: { total: 1 },
      records: [
        {
          id: '1',
          data: { rowNumber: '1', email: 'synthetic@example.test' },
          extended: {},
          warnings: []
        }
      ],
      sourceColumns: ['column_1', 'column_2'],
      offset: 0,
      filteredTotal: 1
    };
    state.classifierDetailRow = null;
    state.classifierOptions = {};
    state.classifierSavedCount = 2;
    let html = importHTML();
    assert.match(html, /id="classifier-remember-layout"/);
    assert.doesNotMatch(html, /id="classifier-remember-layout" checked/);
    assert.match(html, /Сохранено схем: 2/);
    assert.match(html, /data-action="classifier-forget-layouts"/);
    assert.match(html, /Пароли, Cookie, токены и содержимое TXT в шаблоны не записываются/);
    state.classifierOptions.rememberLayout = true;
    html = importHTML();
    assert.match(html, /id="classifier-remember-layout" checked/);
  } finally {
    Object.assign(state, previous);
  }
});
