const { test } = require('node:test');
const assert = require('node:assert/strict');
test('copy adapters cover every section from models and omit credentials/private metadata by default', async () => {
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const { serializeCopy } = await import('../../shared/copy-format.mjs');
  const inputs = {
    generator: {
      id: 'p',
      fields: { name: 'Zoë', phone: '+001', email: 'a@example.com' },
      fieldOrder: ['name', 'phone', 'email']
    },
    import: {
      columns: ['id', 'missing'],
      records: [{ id: 'r', data: { id: '001234567890123456789' } }]
    },
    'import-source': { text: ' exact\r\n' },
    'import-diagnostics': { diagnostics: [{ code: 'PENDING', message: 'rules pending' }] },
    history: {
      items: [
        {
          archiveId: 'a',
          originalName: 'sample.txt',
          processedAt: '2025',
          status: 'completed',
          archiveRoot: '/private/path'
        }
      ]
    },
    'archive-open': {
      entry: { archiveId: 'a', originalName: 'a.txt' },
      resultText: 'result',
      unresolvedText: '',
      diagnostics: '[]'
    },
    checker: [
      {
        id: '001234567890123456789',
        link: 'https://www.facebook.com/001234567890123456789',
        check: { availability: 'unknown', reasonCode: 'LOGIN_REQUIRED' },
        notes: []
      }
    ],
    network: {
      exitIp: '203.0.113.1',
      password: 'SECRET',
      proxyUrl: 'http://u:SECRET@example.com',
      assessment: { score: null, factors: [] },
      sources: {}
    },
    news: {
      items: [
        {
          id: 'n',
          title: 'Article',
          link: 'https://example.com/?access_token=SECRET',
          description: 'Actual summary',
          source: 'Synthetic'
        }
      ]
    },
    photos: [
      {
        fileId: 'f',
        name: 'photo.jpg',
        view: {
          tags: [
            { field: 'gps', value: { latitude: 1, longitude: 2 }, personal: true },
            { field: 'title', value: 'Title' }
          ],
          warnings: []
        }
      }
    ]
  };
  for (const [id, input] of Object.entries(inputs)) {
    const source = copySource(id, input);
    assert.ok(source.fields.length, id);
    const payload = await serializeCopy(
      { scope: 'all', sourceIds: [id], format: 'json' },
      { resolveSource: async () => source }
    );
    assert.ok(!payload.text.includes('SECRET'), id);
    assert.ok(!payload.text.includes('/private/path'), id);
    if (id === 'import') {
      assert.equal(JSON.parse(payload.text)[0].id, '001234567890123456789');
      assert.equal(JSON.parse(payload.text)[0].missing, '');
    }
    if (id === 'photos') assert.ok(!payload.text.includes('latitude'));
    if (id === 'news') assert.ok(!payload.text.includes('body'));
  }
});
test('mass import strips nested credentials and URL secrets while exact disclosed cell remains available', async () => {
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const { serializeCopy } = await import('../../shared/copy-format.mjs');
  const input = {
    columns: ['account', 'url', 'name'],
    records: [
      {
        id: 'r',
        data: {
          account: {
            password: 'SYNTHETIC_SECRET',
            profile: { token: 'SYNTHETIC_TOKEN', label: 'kept' }
          },
          url: 'https://user:SYNTHETIC_PASS@example.test/path?access_token=SYNTHETIC_TOKEN',
          name: 'Visible'
        }
      }
    ]
  };
  const source = copySource('import', input),
    context = { resolveSource: async () => source };
  const mass = await serializeCopy(
    { sourceIds: ['import'], scope: 'all', format: 'json' },
    context
  );
  assert.ok(!mass.text.includes('SYNTHETIC_'));
  assert.ok(mass.text.includes('kept'));
  assert.ok(mass.redactions.includes('account'));
  assert.ok(mass.redactions.includes('url'));
  const single = await serializeCopy(
    {
      sourceIds: ['import'],
      scope: 'value',
      selection: ['r'],
      orderedFields: ['account'],
      format: 'text'
    },
    context
  );
  assert.ok(single.text.includes('SYNTHETIC_SECRET'));
});
test('JSON unsafe numeric ID keeps its source lexeme and adapters reject already rounded numbers', async () => {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const { serializeCopy } = await import('../../shared/copy-format.mjs');
  const parsed = await parseInput({
    bytes: Buffer.from('[{"id":12345678901234567890,"missing":null}]'),
    originalName: 'precision.json'
  });
  const source = copySource('import', parsed);
  const result = await serializeCopy(
    { sourceIds: ['import'], scope: 'all', format: 'json' },
    { resolveSource: async () => source }
  );
  assert.equal(JSON.parse(result.text)[0].id, '12345678901234567890');
  assert.equal(JSON.parse(result.text)[0].missing, '');
  assert.throws(
    () =>
      copySource('import', {
        columns: ['id'],
        records: [{ id: 'r', data: { id: Number('12345678901234567890') } }]
      }),
    /COPY_PRECISION_LOST/
  );
});
test('missing CSV fields render empty in structural preview rather than the word null', async () => {
  const { parseInput } = await import('../../shared/importer.mjs');
  const { state } = await import('../../src/js/state.js');
  const { importHTML } = await import('../../src/js/ui/import.js');
  const parsed = await parseInput({
    bytes: Buffer.from('name,email\nAlice\n'),
    originalName: 'missing.csv'
  });
  state.importData = {
    ...parsed,
    offset: 0,
    counts: { ...parsed.counts, processed: 0, unresolved: 1 }
  };
  try {
    const html = importHTML();
    assert.ok(!html.includes('<span>null</span>'));
    assert.ok(html.includes('<span></span>'));
  } finally {
    state.importData = null;
  }
});
