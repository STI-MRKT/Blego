const { test } = require('node:test');
const assert = require('node:assert/strict');
test('group report and effective operations use existing copy policy and preserve selected order', async () => {
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const { serializeCopy } = await import('../../shared/copy-format.mjs');
  const source = copySource(
    'photos',
    Array.from({ length: 75 }, (_, i) => ({
      fileId: String(i),
      name: `image-${i}`,
      groupName: i % 2 ? 'A' : 'B',
      path: '/private/source',
      view: { tags: [], warnings: [] },
      effectiveOperations: [
        {
          field: 'gps',
          action: 'set',
          value: { latitude: 1, longitude: 2 },
          origin: { kind: 'manual' }
        }
      ]
    }))
  );
  const plain = await serializeCopy(
    { sourceIds: ['photos'], scope: 'all', format: 'json' },
    { resolveSource: async () => source }
  );

  assert.ok(!plain.text.includes('latitude'));
  assert.ok(!plain.text.includes('/private'));
  const selected = await serializeCopy(
    {
      sourceIds: ['photos'],
      scope: 'selected',
      selection: ['74', '0'],
      format: 'json',
      includePersonal: true
    },
    { resolveSource: async () => source }
  );

  assert.ok(selected.text.includes('latitude'));
  const report = copySource('image-report', {
    files: [
      {
        fileId: 'x',
        name: 'copy.png',
        groupName: 'A',
        status: 'completed',
        verification: 'readback_and_pixels',
        changedFields: ['gps'],
        path: '/private',
        before: { gps: 'SECRET' }
      }
    ]
  });
  const output = await serializeCopy(
    { sourceIds: ['image-report'], scope: 'all', format: 'json' },
    { resolveSource: async () => report }
  );

  assert.ok(output.text.includes('readback_and_pixels'));
  assert.ok(!output.text.includes('SECRET'));
  assert.ok(!output.text.includes('/private'));
});
