const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-exclusive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = await imageFixture(root, 'png', { name: 'Камера пробел ✓.png', metadata: false });
  const out = path.join(root, 'Папка копий');
  fs.mkdirSync(out);
  const service = createImageService();
  const [file] = await service.addFiles([source]);
  await service.readImageMetadata(file.fileId);
  service.groups.setGroupOperations({
    groupId: 'ungrouped',
    operations: [
      { field: 'title', action: 'set', value: 'Явное значение', origin: { kind: 'manual' } }
    ]
  });
  const request = {
    scope: 'all',
    workspaceRevision: service.groups.snapshot().revision,
    destinationByGroup: { ungrouped: await service.addDestination(out) }
  };
  return { root, source, out, service, request };
}
test('actual exclusive-link collision retries without overwriting existing Unicode files', async (t) => {
  const { source, out, service, request } = await fixture(t);
  const original = fs.readFileSync(source);
  const existing = path.join(out, path.basename(source));
  fs.writeFileSync(existing, 'existing original name');
  const plan = await service.prepareGroupExport(request);
  const link = fs.promises.link;
  let collision;
  fs.promises.link = async (from, to) => {
    if (!collision && path.dirname(to) === out) {
      collision = to;
      fs.writeFileSync(to, 'existing colliding name', { flag: 'wx' });
    }
    return link(from, to);
  };
  let report;
  try {
    report = await service.applyGroupExport({
      planId: plan.planId,
      workspaceRevision: plan.workspaceRevision,
      runId: 'collision'
    });
  } finally {
    fs.promises.link = link;
  }
  assert.equal(report.files[0].status, 'completed', JSON.stringify(report));
  assert.equal(fs.readFileSync(existing, 'utf8'), 'existing original name');
  assert.equal(fs.readFileSync(collision, 'utf8'), 'existing colliding name');
  assert.deepEqual(fs.readFileSync(source), original);
  assert.ok(report.files[0].outputName.startsWith('Камера пробел ✓_meta_'));
  assert.equal(fs.readdirSync(out).length, 3);
});
test('preflight rejects unsupported linking and actual read-only destination before export', async (t) => {
  const { out, service, request } = await fixture(t);
  const link = fs.promises.link;
  fs.promises.link = async () => {
    throw Object.assign(Error('controlled unsupported filesystem'), { code: 'EOPNOTSUPP' });
  };
  try {
    await assert.rejects(
      service.prepareGroupExport(request),
      /DESTINATION_EXCLUSIVE_LINK_UNSUPPORTED/
    );
  } finally {
    fs.promises.link = link;
  }
  assert.deepEqual(fs.readdirSync(out), []);
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    fs.chmodSync(out, 0o500);
    try {
      await assert.rejects(service.prepareGroupExport(request), /EACCES|EPERM/);
    } finally {
      fs.chmodSync(out, 0o700);
    }
    assert.deepEqual(fs.readdirSync(out), []);
  } else
    t.diagnostic('Real chmod denial not exercised on this host; controlled link failure only.');
});
