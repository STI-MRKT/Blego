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
