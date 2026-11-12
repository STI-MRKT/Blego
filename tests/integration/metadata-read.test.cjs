const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { imageFixture } = require('../fixtures/images.cjs');
test('real JPEG/PNG/WebP read and plans preserve originals; tokens do not authorize arbitrary files', async (t) => {
  const { createImageService } = require('../../electron/features/images/service.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-metadata-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = createImageService();
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = await imageFixture(root, format, {
      name: `-кириллица.${format === 'jpeg' ? 'jpg' : format}`
    });
    const digest = () => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const before = digest();
    const [registered] = await service.addFiles([file]);
    const view = await service.readImageMetadata(registered.fileId);
    assert.equal(view.detectedFormat, format);
    assert.equal(view.sourceHash, before);
    assert.equal(view.tags.find((tag) => tag.field === 'title').value, 'Исходный заголовок');
    assert.equal(view.tags.find((tag) => tag.field === 'gps').value.latitude, 12.5);
    const plan = service.planMetadataChanges({
      fileIds: [view.fileId],
      operations: [{ field: 'title', action: 'set', value: 'Новая подпись' }]
    });
    assert.equal(plan.files[0].beforeAfter[0].after, 'Новая подпись');
    assert.equal(digest(), before);
  }
  await assert.rejects(service.readImageMetadata('/etc/passwd'), { message: 'INVALID_FILE_TOKEN' });
  const bad = path.join(root, 'bad.jpg');
  fs.writeFileSync(bad, 'GIF89a');
  const [registered] = await service.addFiles([bad]);
  await assert.rejects(service.readImageMetadata(registered.fileId), {
    message: 'METADATA_UNSUPPORTED'
  });
});
test('animation, signed provenance, mixed values and external ExifTool config are handled explicitly', async (t) => {
  const { createImageService } = require('../../electron/features/images/service.cjs');
  const { inspectStructure } = require('../../electron/features/images/structure.cjs');
  const { crc32 } = require('node:zlib');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-metadata-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = await imageFixture(root, 'png', { metadata: false });
  const original = fs.readFileSync(file);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(type, 4);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([head, data, crc]);
  };
  assert.throws(
    () =>
      inspectStructure(
        Buffer.concat([
          original.subarray(0, 33),
          chunk('acTL', Buffer.alloc(8)),
          original.subarray(33)
        ])
      ),
    { message: 'ANIMATED_IMAGE_UNSUPPORTED' }
  );
  const signed = path.join(root, 'signed.png');
  fs.writeFileSync(
    signed,
    Buffer.concat([
      original.subarray(0, 33),
      chunk('caBX', Buffer.from('synthetic c2pa fixture')),
      original.subarray(33)
    ])
  );
  const service = createImageService();
  const [item] = await service.addFiles([signed]);
  const view = await service.readImageMetadata(item.fileId);
  assert.equal(view.capabilities.writable, false);
  assert.throws(
    () =>
      service.planMetadataChanges({
        fileIds: [item.fileId],
        operations: [{ field: 'title', action: 'set', value: 'x' }]
      }),
    { message: 'SIGNED_PROVENANCE_UNSUPPORTED' }
  );
  const wrong = path.join(root, 'disguised.jpg');
  fs.copyFileSync(file, wrong);
  const [bad] = await service.addFiles([wrong]);
  await assert.rejects(service.readImageMetadata(bad.fileId), {
    message: 'FORMAT_EXTENSION_MISMATCH'
  });
  const marker = path.join(root, 'config-executed');
  fs.writeFileSync(
    path.join(root, '.ExifTool_config'),
    `open(my $f, '>', '${marker}'); print $f 'executed'; 1;`
  );
  const previous = process.env.EXIFTOOL_HOME;
  process.env.EXIFTOOL_HOME = root;
  try {
    const [plain] = await service.addFiles([file]);
    await service.readImageMetadata(plain.fileId);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    if (previous === undefined) delete process.env.EXIFTOOL_HOME;
    else process.env.EXIFTOOL_HOME = previous;
  }
});
