const { test } = require('node:test');
const assert = require('node:assert/strict');
test('explicit_keep_overrides_group_set; inherit resolves group; defaults never invent values', async () => {
  const { emptyWorkspace, resolveFileOperations, validateWorkspace } =
    await import('../../shared/image-workspace.mjs');
  const w = emptyWorkspace();
  w.groups.push({
    id: 'g',
    name: 'Manual',
    operations: [
      { field: 'title', action: 'set', value: 'Group title', origin: { kind: 'manual' } }
    ]
  });
  w.membership.f = 'g';
  w.overrides.f = [{ field: 'title', action: 'keep' }];
  assert.deepEqual(
    resolveFileOperations(w, 'f').find((o) => o.field === 'title'),
    { field: 'title', action: 'keep' }
  );
  w.overrides.f = [{ field: 'title', action: 'inherit' }];
  assert.equal(resolveFileOperations(w, 'f').find((o) => o.field === 'title').value, 'Group title');
  assert.ok(resolveFileOperations(w, 'f').every((o) => o.action !== 'inherit'));
  assert.deepEqual(validateWorkspace(w), w);
  const blank = emptyWorkspace();
  blank.membership.f = 'ungrouped';
  assert.ok(
    resolveFileOperations(blank, 'f').every(
      (o) => o.action === 'keep' && !Object.hasOwn(o, 'value')
    )
  );
});
test('empty set, implicit origins, unknown fields and executable/path-shaped workspace input reject', async () => {
  const { emptyWorkspace, validateWorkspaceOperations, validateWorkspace } =
    await import('../../shared/image-workspace.mjs');
  for (const ops of [
    [{ field: 'title', action: 'set', value: '', origin: { kind: 'manual' } }],
    [{ field: 'make', action: 'set', value: 'Invented' }],
    [{ field: 'Orientation', action: 'remove' }],
    [{ field: 'title', action: 'set', value: 'x', origin: { kind: 'clock' } }]
  ])
    assert.throws(() => validateWorkspaceOperations(ops));
  assert.throws(() => validateWorkspace({ ...emptyWorkspace(), path: '/private' }));
});
