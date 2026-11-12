// Explicit synthetic load check, outside the ordinary regression suite.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { imageFixture } = require('../tests/fixtures/images.cjs');
const { createImageService } = require('../electron/features/images/service.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-batch-'));
  let peak = 0;
  const sample = () => {
    let rss = process.memoryUsage().rss;
    try {
      for (const pid of fs
        .readFileSync(`/proc/${process.pid}/task/${process.pid}/children`, 'utf8')
        .trim()
        .split(/\s+/)
        .filter(Boolean)) {
        const m = fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/);
        if (m) rss += Number(m[1]) * 1024;
      }
    } catch {}
    peak = Math.max(peak, rss);
  };
  const timer = setInterval(sample, 20),
    started = Date.now();
  try {
    const file = await imageFixture(root, 'png');
    const output = path.join(root, 'out');
    fs.mkdirSync(output);
    const service = createImageService();
    const items = await service.addFiles(Array(100).fill(file));
    await Promise.all(items.map((item) => service.readImageMetadata(item.fileId)));
    const plan = service.planMetadataChanges({
      fileIds: items.map((i) => i.fileId),
      operations: [{ field: 'title', action: 'set', value: 'Synthetic 100-file check' }]
    });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(output)
    });
    const counts = Object.fromEntries(
      [...new Set(result.files.map((f) => f.status))].map((status) => [
        status,
        result.files.filter((f) => f.status === status).length
      ])
    );
    console.log(
      JSON.stringify(
        {
          files: 100,
          counts,
          elapsedSeconds: (Date.now() - started) / 1000,
          peakParentAndDirectChildRssMiB: Math.ceil(peak / 1048576),
          fixture: '12×8 RGBA PNG; not a worst-case 40 MP/512 MiB test'
        },
        null,
        2
      )
    );
    if (counts.completed !== 100) throw Error('Batch failure');
  } finally {
    clearInterval(timer);
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
