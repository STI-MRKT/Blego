// Explicit synthetic native-engine acceptance; never opens a real user's images.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { imageFixture } = require('../tests/fixtures/images.cjs');
const { createImageService } = require('../electron/features/images/service.cjs');
const { createEngine } = require('../electron/features/images/engine.cjs');
const { normalizedValue } = require('../electron/features/images/policy.cjs');
const sharp = require('sharp');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-date-geo-load-')),
    report = {
      at: new Date().toISOString(),
      os: process.platform,
      arch: process.arch,
      fixture: 'Synthetic 12×8 RGBA/oriented images, not worst-case 40 MP stress',
      batches: []
    };
  try {
    const bases = [];
    for (const format of ['jpeg', 'png', 'webp']) bases.push(await imageFixture(root, format));
    for (const count of [1, 10, 100]) {
      const dir = path.join(root, String(count)),
        out = path.join(dir, 'out');
      fs.mkdirSync(out, { recursive: true });
      const files = Array.from({ length: count }, (_, i) => {
        const base = bases[i % 3],
          file = path.join(dir, `${i}${path.extname(base)}`);
        fs.copyFileSync(base, file);
        return file;
      });
      const hashes = files.map(sha),
        started = performance.now(),
        service = createImageService(),
        engine = createEngine();
      const items = await service.addFiles(files);
      for (const item of items) await service.readImageMetadata(item.fileId);
      const readMs = performance.now() - started;
      const gps = { latitude: 0, longitude: -73.987654, altitude: 0 };
      const plan = service.planMetadataChanges({
        fileIds: items.map((i) => i.fileId),
        operations: [
          { field: 'gps', action: 'set', value: gps },
          {
            field: 'captureDate',
            action: 'set',
            scope: ['exif', 'xmp'],
            value: { local: '2024-02-29T12:34:56', offsetMode: 'set', offset: '-05:00' }
          }
        ]
      });
      const exportStart = performance.now(),
        result = await service.applyMetadataPlan({
          planId: plan.planId,
          destinationToken: await service.addDestination(out)
        });
      const exportMs = performance.now() - exportStart;
      assert.equal(result.files.filter((f) => f.status === 'completed').length, count);
      for (let i = 0; i < files.length; i++) {
        assert.equal(sha(files[i]), hashes[i]);
        const target = path.join(out, result.files[i].outputName || result.files[i].name);
        const tags = (await engine.read(target)).tags;
        assert.deepEqual(normalizedValue('gps', tags), gps);
        assert.deepEqual(normalizedValue('captureDate', tags), {
          local: '2024-02-29T12:34:56',
          offset: '-05:00'
        });
        assert.equal(normalizedValue('author', tags), 'Example Author');
        assert.deepEqual(
          await sharp(target).raw().toBuffer(),
          await sharp(files[i]).raw().toBuffer()
        );
      }
      report.batches.push({
        count,
        completed: count,
        readMs: Math.round(readMs),
        exportMs: Math.round(exportMs),
        totalMs: Math.round(performance.now() - started),
        readback: 'PASS',
        originalHashes: 'PASS',
        pixelsAndAlpha: 'PASS',
        date: '2024-02-29T12:34:56-05:00',
        gps
      });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const output = process.argv[2] || 'release/metadata-load.json';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
