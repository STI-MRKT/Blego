const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { validateOperations } = require('../../electron/features/images/policy.cjs');
test('camera numbers validate and round-trip in real JPEG PNG WebP copies', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-camera-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const field of ['iso', 'fNumber', 'focalLength', 'exposureTime']) {
    for (const value of [0, -1, Infinity, '', '1/0', 'camera'])
      assert.throws(() => validateOperations([{ field, action: 'set', value }]));
  }
  assert.throws(() => validateOperations([{ field: 'iso', action: 'set', value: 1.5 }]));
  const operations = [
    { field: 'iso', action: 'set', value: 200 },
    { field: 'fNumber', action: 'set', value: 2.8 },
    { field: 'focalLength', action: 'set', value: 35 },
    { field: 'exposureTime', action: 'set', value: '1/125' }
  ];
  for (const format of ['jpeg', 'png', 'webp']) {
    const source = await imageFixture(root, format);
    const original = fs.readFileSync(source);
    const service = createImageService();
    const [file] = await service.addFiles([source]);
    await service.readImageMetadata(file.fileId);
    const plan = service.planMetadataChanges({ fileIds: [file.fileId], operations });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(root)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(source), original);
  }
});
test(
  'real multi-value ISO survives a title-only grouped export',
  { skip: process.platform === 'win32' },
  async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-multi-iso-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = await imageFixture(root, 'png', { metadata: false });
    const runtime = path.resolve('build/metadata-runtime', `${process.platform}-${process.arch}`);
    require('node:child_process').execFileSync(
      path.join(runtime, 'bin/perl'),
      [
        path.resolve('resources/metadata/perl-bootstrap.pl'),
        require('exiftool-vendored.pl'),
        '-config',
        '',
        '-overwrite_original',
        '-EXIF:ISO=100 200',
        '--',
        source
      ],
      {
        env: {
          ...process.env,
          BLEGO_PERL_LIBS: [path.join(runtime, 'lib/core'), path.join(runtime, 'lib/arch')].join(
            '\x1f'
          )
        }
      }
    );
    const service = createImageService();
    const [f] = await service.addFiles([source]);
    const view = await service.readImageMetadata(f.fileId);
    assert.equal(view.tags.find((t) => t.field === 'iso').value, '100 200');
    assert.equal(view.tags.find((t) => t.field === 'iso').referenceSupported, false);
    service.groups.setGroupOperations({
      groupId: 'ungrouped',
      operations: [
        { field: 'title', action: 'set', value: 'Only title changes', origin: { kind: 'manual' } }
      ]
    });
    const plan = await service.prepareGroupExport({
      scope: 'all',
      workspaceRevision: service.groups.snapshot().revision,
      destinationByGroup: { ungrouped: await service.addDestination(root) }
    });
    const report = await service.applyGroupExport({
      planId: plan.planId,
      workspaceRevision: plan.workspaceRevision,
      runId: 'multi-iso'
    });
    assert.equal(report.files[0].status, 'completed', JSON.stringify(report));
  }
);
