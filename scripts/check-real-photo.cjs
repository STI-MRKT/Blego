// Developer QA only: pinned, licensed public photograph. Never reads user photos.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { createRequire } = require('node:module'),
  { createHash } = require('node:crypto'),
  { monitorEventLoopDelay } = require('node:perf_hooks');
const [project, input, output] = process.argv.slice(2);
if (!project || !input || !output) throw Error('Usage: project original-public-photo report');
const req = createRequire(path.resolve(project, 'package.json')),
  sharp = req('sharp');
const { createImageService } = req('./electron/features/images/service.cjs'),
  { createEngine } = req('./electron/features/images/engine.cjs'),
  { normalizedValue } = req('./electron/features/images/policy.cjs');
const sha = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async () => {
  assert.equal(sha(input), '24eb29eccdf0af691b406d1a3d22c0ef5d761cc454d8a917848c33958f6fc857');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-real-photo-')),
    report = {
      at: new Date().toISOString(),
      os: process.platform,
      arch: process.arch,
      node: process.version,
      source: {
        url: 'https://commons.wikimedia.org/wiki/File:Fronalpstock_big.jpg',
        download: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg',
        artist: 'Hannes Röst',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
        sha256: sha(input)
      },
      method:
        'Real public landscape panorama, resized to 6000px for 40MP limit; JPEG/PNG/WebP derivatives made before measurement. Three actual exports with explicit date/GPS. Same source, transformations and machine for baseline/candidate. Parent Node RSS (not child-process total). Single sample, not cold-cache benchmark.',
      files: []
    };
  let sampling;
  const delay = monitorEventLoopDelay({ resolution: 20 });
  try {
    const out = path.join(root, 'out');
    fs.mkdirSync(out);
    const files = [];
    for (const format of ['jpeg', 'png', 'webp']) {
      const file = path.join(root, `landscape.${format}`);
      await sharp(input, { limitInputPixels: 50000000 })
        .resize({ width: 6000 })
        .withMetadata()
        .toFormat(format)
        .toFile(file);
      files.push(file);
      const meta = await sharp(file).metadata();
      report.files.push({
        format,
        width: meta.width,
        height: meta.height,
        bytes: fs.statSync(file).size,
        sha256: sha(file)
      });
    }
    const originals = files.map(sha),
      service = createImageService(),
      engine = createEngine();
    let peakRss = process.memoryUsage().rss;
    delay.enable();
    sampling = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 50);
    sampling.unref();
    const start = performance.now(),
      items = await service.addFiles(files);
    for (const item of items) await service.readImageMetadata(item.fileId);
    report.readMs = performance.now() - start;
    const gps = { latitude: 48.8566, longitude: 2.3522, altitude: 0 };
    const plan = service.planMetadataChanges({
      fileIds: items.map((i) => i.fileId),
      operations: [
        { field: 'gps', action: 'set', value: gps },
        {
          field: 'captureDate',
          action: 'set',
          scope: ['exif', 'xmp'],
          value: { local: '2024-02-29T12:34:56', offsetMode: 'set', offset: '+03:00' }
        }
      ]
    });
    const ex = performance.now(),
      result = await service.applyMetadataPlan({
        planId: plan.planId,
        destinationToken: await service.addDestination(out)
      });
    report.exportMs = performance.now() - ex;
    assert.equal(result.files.filter((f) => f.status === 'completed').length, 3);
    for (const f of result.files) {
      const i = items.findIndex((x) => x.fileId === f.fileId),
        target = path.join(out, f.outputName || f.name);
      assert.equal(sha(files[i]), originals[i]);
      const tags = (await engine.read(target)).tags;
      const actual = normalizedValue('gps', tags);
      for (const k of ['latitude', 'longitude', 'altitude'])
        assert.ok(Math.abs(actual[k] - gps[k]) < 1e-6);
      assert.deepEqual(normalizedValue('captureDate', tags), {
        local: '2024-02-29T12:34:56',
        offset: '+03:00'
      });
      const pixels = async (p) =>
        createHash('sha256')
          .update(await sharp(p).raw().toBuffer())
          .digest('hex');
      assert.equal(await pixels(files[i]), await pixels(target));
    }
    report.totalMs = performance.now() - start;
    report.peakRssBytes = peakRss;
    report.eventLoopP95Ms = delay.percentile(95) / 1e6;
    report.originalHashes = 'PASS';
    report.pixels = 'PASS';
    report.dateGpsReadback = 'PASS';
    report.status = 'PASS';
  } finally {
    clearInterval(sampling);
    delay.disable();
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
