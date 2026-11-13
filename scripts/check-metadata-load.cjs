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
const folderLoad = process.env.BLEGO_FOLDER_LOAD === '1';
const generatedGeo = process.env.BLEGO_GEO_LOAD === '1' || folderLoad;
const { monitorEventLoopDelay } = require('node:perf_hooks');
const { createGeoService } = require('../electron/features/geo/service.cjs');
const { validateBoundary, contains } = require('../electron/features/geo/geometry.cjs');
const parisBoundary = generatedGeo
  ? validateBoundary(
      require('../resources/geo/cities.json').cities.find((c) => c.id === 'osm:relation:71525')
        .geometry
    )
  : null;
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-date-geo-load-')),
    report = {
      at: new Date().toISOString(),
      os: process.platform,
      arch: process.arch,
      fixture: generatedGeo
        ? 'Synthetic 12×8 batches plus 4000×3000 RGBA/oriented JPEG/PNG/WebP; not worst-case 40 MP stress'
        : 'Synthetic 12×8 RGBA/oriented images, not worst-case 40 MP stress',
      batches: []
    };
  try {
    const bases = [];
    for (const format of ['jpeg', 'png', 'webp']) bases.push(await imageFixture(root, format));
    for (const count of [
      1,
      10,
      100,
      ...(folderLoad ? [500, 1000] : []),
      ...(generatedGeo ? [3] : [])
    ]) {
      const highResolution = generatedGeo && count === 3;
      if (highResolution)
        for (const [i, format] of ['jpeg', 'png', 'webp'].entries())
          bases[i] = await imageFixture(root, format, {
            name: `high.${format}`,
            width: 4000,
            height: 3000
          });
      const dir = path.join(root, String(count)),
        out = path.join(dir, 'out');
      fs.mkdirSync(out, { recursive: true });
      const files = Array.from({ length: count }, (_, i) => {
        const base = bases[i % 3],
          file = path.join(
            dir,
            ...(folderLoad ? ['album', `set-${i % 5}`] : []),
            `${i}${path.extname(base)}`
          );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(base, file);
        return file;
      });
      const hashes = files.map(sha),
        started = performance.now(),
        geo = generatedGeo ? createGeoService() : null,
        service = createImageService({ geo }),
        engine = createEngine();
      let peakRss = process.memoryUsage().rss;
      const delay = monitorEventLoopDelay({ resolution: 20 });
      delay.enable();
      const sampling = setInterval(() => {
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
      }, 50);
      sampling.unref();
      const scanStarted = performance.now();
      const items = await service.addFiles(folderLoad ? [path.join(dir, 'album')] : files);
      const scanMs = performance.now() - scanStarted;
      const sourceById = new Map(
        items.map((item) => [item.fileId, files.find((file) => path.basename(file) === item.name)])
      );
      for (const item of items) await service.readImageMetadata(item.fileId);
      const readMs = performance.now() - started;
      const gps = { latitude: 0, longitude: -73.987654, altitude: 0 };
      let plan = service.planMetadataChanges({
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
      if (generatedGeo) {
        service.groups.setGroupOperations({
          groupId: 'ungrouped',
          operations: [
            {
              field: 'captureDate',
              action: 'set',
              scope: ['exif', 'xmp'],
              value: { local: '2024-02-29T12:34:56', offsetMode: 'set', offset: '-05:00' },
              origin: { kind: 'manual' }
            }
          ]
        });
        await service.generateGeo({
          cityId: 'osm:relation:71525',
          fileIds: items.map((i) => i.fileId),
          requestId: 'load-' + count
        });
        plan = await service.prepareGroupExport({
          scope: 'all',
          workspaceRevision: service.groups.snapshot().revision,
          destinationByGroup: { ungrouped: await service.addDestination(out) }
        });
        assert.equal(
          new Set(
            plan.files.map((f) => JSON.stringify(f.operations.find((o) => o.field === 'gps').value))
          ).size,
          count
        );
      }
      const exportStart = performance.now(),
        result = generatedGeo
          ? await service.applyGroupExport({
              planId: plan.planId,
              workspaceRevision: plan.workspaceRevision,
              runId: 'load-' + count
            })
          : await service.applyMetadataPlan({
              planId: plan.planId,
              destinationToken: await service.addDestination(out)
            });
      const exportMs = performance.now() - exportStart;
      assert.equal(result.files.filter((f) => f.status === 'completed').length, count);
      const storedPoints = new Set();
      for (let i = 0; i < files.length; i++) {
        assert.equal(sha(files[i]), hashes[i]);
        const target = path.join(out, result.files[i].outputName || result.files[i].name);
        const source = sourceById.get(result.files[i].fileId);
        const tags = (await engine.read(target)).tags;
        const expected = generatedGeo
          ? plan.files[i].operations.find((o) => o.field === 'gps').value
          : gps;
        const actual = normalizedValue('gps', tags);
        if (generatedGeo) {
          assert.ok(contains(parisBoundary, actual.longitude, actual.latitude));
          storedPoints.add(`${actual.latitude.toFixed(7)},${actual.longitude.toFixed(7)}`);
        }
        for (const key of ['latitude', 'longitude'])
          assert.ok(Math.abs(actual[key] - expected[key]) < 1e-6);
        assert.equal(actual.altitude, expected.altitude);
        assert.deepEqual(normalizedValue('captureDate', tags), {
          local: '2024-02-29T12:34:56',
          offset: '-05:00'
        });
        assert.equal(normalizedValue('author', tags), 'Example Author');
        assert.deepEqual(
          await sharp(target).raw().toBuffer(),
          await sharp(source).raw().toBuffer()
        );
      }
      if (generatedGeo) assert.equal(storedPoints.size, count);
      clearInterval(sampling);
      delay.disable();
      report.batches.push({
        folderLoad,
        scanMs,
        peakRssBytes: peakRss,
        eventLoopP95Ms: delay.percentile(95) / 1e6,
        count,
        completed: count,
        readMs: Math.round(readMs),
        exportMs: Math.round(exportMs),
        totalMs: Math.round(performance.now() - started),
        readback: 'PASS',
        originalHashes: 'PASS',
        pixelsAndAlpha: 'PASS',
        date: '2024-02-29T12:34:56-05:00',
        gps: generatedGeo ? 'unique per file inside OSM Paris boundary' : gps,
        dimensions: highResolution ? '4000×3000' : '12×8'
      });
      console.log(
        JSON.stringify({
          batch: count,
          folderLoad,
          completed: count,
          totalMs: Math.round(performance.now() - started)
        })
      );
      geo?.close();
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
