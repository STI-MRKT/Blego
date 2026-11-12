const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safeName, validEntryName } = require('../../electron/features/archive/manifest.cjs');
test('safe archive names preserve Cyrillic and reject extraction attacks', () => {
  assert.match(safeName('../пример.txt'), /пример/);
  assert.ok(!safeName('../пример.txt').includes('/'));
  for (const x of ['../x', '/x', 'C:/x', 'a\\b', 'a/../b', 'a//b'])
    assert.equal(validEntryName(x), false);
  assert.equal(validEntryName('source/original.txt'), true);
});
test('manifest metadata cannot carry HTML in numeric fields', () => {
  const { validateManifest, hash } = require('../../electron/features/archive/manifest.cjs');
  const entries = { 'result.txt': Buffer.from('x'), 'diagnostics.jsonl': Buffer.alloc(0) };
  const m = {
    version: 1,
    archiveId: '11111111-1111-1111-1111-111111111111',
    operationId: '22222222-2222-2222-2222-222222222222',
    status: 'completed',
    processedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    originalName: 'test.txt',
    sourceSize: 1,
    offsetMinutes: 0,
    rulesVersion: 'TEST-1',
    counts: { processed: '<img>', unresolved: '', total: '<img>' },
    entries: Object.fromEntries(
      Object.entries(entries).map(([k, b]) => [k, { size: b.length, sha256: hash(b) }])
    )
  };
  assert.throws(() => validateManifest(m, entries));
});
