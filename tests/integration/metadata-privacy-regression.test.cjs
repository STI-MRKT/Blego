const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { execFileSync } = require('node:child_process');
const { imageFixture } = require('../fixtures/images.cjs');
const { createImageService } = require('../../electron/features/images/service.cjs');
const { createEngine } = require('../../electron/features/images/engine.cjs');
async function setup(t, tags) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-private-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = await imageFixture(root),
    output = path.join(root, 'out');
  fs.mkdirSync(output);
  const runtime = path.resolve('build/metadata-runtime', `${process.platform}-${process.arch}`);
  execFileSync(
    path.join(runtime, 'bin/perl'),
    [
      path.resolve('resources/metadata/perl-bootstrap.pl'),
      require('exiftool-vendored.pl'),
      '-config',
      '',
      '-overwrite_original',
      '-n',
      ...tags,
      '--',
      file
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
  const [item] = await service.addFiles([file]);
  await service.readImageMetadata(item.fileId);
  return { service, item, output, file };
}
test('privacy removes actual ExifIFD OwnerName and SerialNumber tags', async (t) => {
  const { service, item, output, file } = await setup(t, [
    '-EXIF:OwnerName=Synthetic Owner',
    '-EXIF:SerialNumber=TEST-123'
  ]);
  const before = (await createEngine().read(file)).tags;
  assert.ok(Object.keys(before).some((k) => k.endsWith(':OwnerName')));
  assert.ok(Object.keys(before).some((k) => k.endsWith(':SerialNumber')));
  const plan = service.planMetadataChanges({ fileIds: [item.fileId], presetId: 'privacy-v1' });
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(output)
  });
  assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
  const after = (await createEngine().read(path.join(output, result.files[0].outputName))).tags;
  assert.ok(!Object.keys(after).some((k) => /:(OwnerName|SerialNumber)$/.test(k)));
});
test('GPS set removes stale IPTC Extension locations and verifies each remaining coordinate copy', async (t) => {
  const { service, item, output, file } = await setup(t, [
    '-XMP-iptcExt:LocationCreatedGPSLatitude=40.7128',
    '-XMP-iptcExt:LocationCreatedGPSLongitude=-74.006',
    '-XMP-iptcExt:LocationShownGPSLatitude=41.5',
    '-XMP-iptcExt:LocationShownGPSLongitude=-75.5'
  ]);
  const before = (await createEngine().read(file)).tags;
  assert.ok(Object.keys(before).some((k) => k.includes('LocationCreatedGPSLatitude')));
  const plan = service.planMetadataChanges({
    fileIds: [item.fileId],
    operations: [
      { field: 'gps', action: 'set', value: { latitude: 1, longitude: 2, altitude: null } }
    ]
  });
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(output)
  });
  assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
  const after = (await createEngine().read(path.join(output, result.files[0].outputName))).tags;
  assert.ok(!Object.keys(after).some((k) => /Location(?:Created|Shown)GPS/.test(k)));
  const { verifyTags } = require('../../electron/features/images/write-policy.cjs');
  assert.throws(
    () =>
      verifyTags(
        [{ field: 'gps', action: 'set', value: { latitude: 1, longitude: 2, altitude: null } }],
        {},
        { ...after, 'XMP-exif:GPSLatitude': '99' }
      ),
    /VERIFY/
  );
});
test('JPEG COM comment is updated and removed along with EXIF/XMP comment copies', async (t) => {
  const { service, item, output } = await setup(t, ['-Comment=Old synthetic COM']);
  const plan = service.planMetadataChanges({
    fileIds: [item.fileId],
    operations: [{ field: 'comment', action: 'set', value: 'New synthetic comment' }]
  });
  const result = await service.applyMetadataPlan({
    planId: plan.planId,
    destinationToken: await service.addDestination(output)
  });
  assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
  const after = (await createEngine().read(path.join(output, result.files[0].outputName))).tags;
  assert.equal(after['File:Comment'], 'New synthetic comment');
  const [copy] = await service.addFiles([path.join(output, result.files[0].outputName)]);
  await service.readImageMetadata(copy.fileId);
  const remove = service.planMetadataChanges({
    fileIds: [copy.fileId],
    operations: [{ field: 'comment', action: 'remove' }]
  });
  const removed = await service.applyMetadataPlan({
    planId: remove.planId,
    destinationToken: await service.addDestination(output)
  });
  assert.equal(removed.files[0].status, 'completed', JSON.stringify(removed));
  assert.ok(
    !Object.keys(
      (await createEngine().read(path.join(output, removed.files[0].outputName))).tags
    ).some((k) => /:(?:Comment|UserComment)$/.test(k))
  );
});
