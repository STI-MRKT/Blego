const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('TZ15 page BIO and generated statuses omit terminal dots and end with themed emoji', async (t) => {
  const { pageBio } = require('../../electron/features/generator/biography.cjs');
  for (const type of ['model', 'tech', 'crypto']) {
    const result = pageBio('Making complex systems easier to understand.', type);
    assert.doesNotMatch(result, /\.[\s\p{Extended_Pictographic}]*$/u);
    assert.match(result, /\p{Extended_Pictographic}/u);
    assert.equal(pageBio(result, type), result, 'decoration must be idempotent');
  }
  const { openStore } = require('../../electron/local/store.cjs');
  const { generateProfile } = require('../../electron/features/generator/service.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz15-status-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const type of ['model', 'tech', 'crypto']) {
    const result = await generateProfile({ country: 'US', type, requestId: type }, { store });
    for (const key of ['bio', 'status']) {
      assert.ok(result.fields[key], key);
      assert.doesNotMatch(result.fields[key], /\.$/u);
      assert.match(result.fields[key], /\p{Extended_Pictographic}/u);
    }
    assert.equal(result.fields.email.includes('@'), true);
  }
});

test('TZ15 classifier bottom panels removed, with field mapping and export still accessible', async () => {
  const { state } = await import('../../src/js/state.js');
  const { importHTML } = await import('../../src/js/ui/import.js');
  const previous = {
    importData: state.importData,
    importStep: state.importStep,
    importName: state.importName
  };
  try {
    state.importStep = 'ready';
    state.importData = {
      status: 'preview_partial',
      counts: { total: 1 },
      records: [
        {
          id: '1',
          data: { rowNumber: '1', password: '', emailPassword: '' },
          extended: {},
          warnings: [],
          sourceEntries: []
        }
      ],
      sourceColumns: ['column_1'],
      offset: 0,
      filteredTotal: 1,
      diagnostics: []
    };
    const html = importHTML();
    assert.doesNotMatch(html, /id="classifier-extra"/);
    assert.doesNotMatch(html, /<summary>Дополнительно<\/summary>/);
    assert.doesNotMatch(html, /<summary>Уточнить поля<\/summary>/);
    assert.match(html, /data-action="classifier-archive"/);
    assert.match(html, /data-action="classifier-export"/);
    assert.match(html, /id="classifier-options"/);
    assert.match(html, /data-classifier-map/);
  } finally {
    Object.assign(state, previous);
  }
});
