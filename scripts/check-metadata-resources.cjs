// Explicit synthetic boundary run; generated files never enter Git.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const sharp = require('sharp');
const { createImageService } = require('../electron/features/images/service.cjs');
const { imageFixture } = require('../tests/fixtures/images.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-resource-'));
  const start = Date.now();
  let peak = 0,
    maxGap = 0,
    last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
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
  }, 20);
  const checks = [];
  try {
    const big = path.join(root, '40MP.png');
    await sharp({ create: { width: 8000, height: 5000, channels: 3, background: '#6789ab' } })
      .png()
      .toFile(big);
    let service = createImageService();
    let [f] = await service.addFiles([big]);
    let view = await service.readImageMetadata(f.fileId);
    assert.equal(view.imageInfo.width * view.imageInfo.height, 40000000);
    const plan = service.planMetadataChanges({
      fileIds: [f.fileId],
      operations: [{ field: 'title', action: 'set', value: 'Explicit synthetic boundary' }]
    });
    const result = await service.applyMetadataPlan({
      planId: plan.planId,
      destinationToken: await service.addDestination(root)
    });
    assert.equal(result.files[0].status, 'completed', JSON.stringify(result));
    checks.push('40MP actual decode/write/readback PASS');
    const over = path.join(root, 'over-40MP.png');
    await sharp({ create: { width: 8001, height: 5000, channels: 3, background: '#6789ab' } })
      .png()
      .toFile(over);
    [f] = await service.addFiles([over]);
    await assert.rejects(service.readImageMetadata(f.fileId));
    checks.push('40,005,000 pixels rejected PASS');
    const small = await imageFixture(root, 'png', { metadata: false });
    const bytes = fs.readFileSync(small);
    function padded(file, size) {
      const chunk = Buffer.alloc(size - bytes.length);
      chunk.writeUInt32BE(chunk.length - 12);
      chunk.write('npAD', 4, 'ascii');
      chunk.writeUInt32BE(require('node:zlib').crc32(chunk.subarray(4, -4)), chunk.length - 4);
      fs.writeFileSync(file, Buffer.concat([bytes.subarray(0, -12), chunk, bytes.subarray(-12)]));
    }
    const boundary = path.join(root, '50MiB.png');
    padded(boundary, 50 * 1024 * 1024);
    service = createImageService();
    [f] = await service.addFiles([boundary]);
    view = await service.readImageMetadata(f.fileId);
    assert.equal(view.size, 50 * 1024 * 1024);
    checks.push('50MiB actual bounded read/decode (PNG with valid private ancillary chunk) PASS');
    const tooBig = path.join(root, 'over-50MiB.png');
    fs.copyFileSync(boundary, tooBig);
    fs.appendFileSync(tooBig, 'x');
    await assert.rejects(service.addFiles([tooBig]), /IMAGE_TOO_LARGE/);
    checks.push('50MiB + 1 rejected PASS');
    const paths = [];
    for (let i = 0; i < 10; i++) {
      const p = path.join(root, `total-${i}.png`);
      fs.copyFileSync(boundary, p);
      paths.push(p);
    }
    const tail = path.join(root, 'total-tail.png');
    padded(tail, 12 * 1024 * 1024);
    paths.push(tail);
    service = createImageService();
    const batch = await service.addFiles(paths);
    assert.equal(
      batch.reduce((a, f) => a + f.size, 0),
      512 * 1024 * 1024
    );
    await assert.rejects(service.addFiles([small]), /IMAGE_QUEUE_LIMIT/);
    checks.push('512MiB registered exactly; over-limit rejected PASS (not whole-batch decode)');
    service.clear();
    const ref = await service.addReference(small);
    assert.ok(ref.referenceId);
    await assert.rejects(service.addFiles(paths), /IMAGE_QUEUE_LIMIT/);
    checks.push('reference consumes shared byte limit PASS');
    // A separate exact-total batch leaves per-file headroom for newly written metadata.
    for (const file of paths.slice(0, 10)) padded(file, 49 * 1024 * 1024);
    padded(tail, 22 * 1024 * 1024);
    service = createImageService();
    const heavy = await service.addFiles(paths);
    assert.equal(
      heavy.reduce((sum, f) => sum + f.size, 0),
      512 * 1024 * 1024
    );
    await Promise.all(heavy.map((f) => service.readImageMetadata(f.fileId)));
    service.groups.setGroupOperations({
      groupId: 'ungrouped',
      operations: [
        { field: 'title', action: 'set', value: 'Explicit 512MiB QA', origin: { kind: 'manual' } }
      ]
    });
    const destinationByGroup = { ungrouped: await service.addDestination(root) };
    const prepare = (extra) =>
      service.prepareGroupExport({
        scope: 'all',
        workspaceRevision: service.groups.snapshot().revision,
        destinationByGroup,
        ...extra
      });
    let groupPlan = await prepare();
    let cancelAt;
    const cancelled = await service.applyGroupExport(
      {
        planId: groupPlan.planId,
        workspaceRevision: groupPlan.workspaceRevision,
        runId: 'heavy-cancel'
      },
      (event) => {
        if (event.status === 'completed' && !cancelAt) {
          cancelAt = performance.now();
          service.cancelGroupExport({ runId: 'heavy-cancel' });
        }
      }
    );
    const cancelSettledMs = Math.round(performance.now() - cancelAt);
    assert.ok(cancelled.files.some((f) => f.status === 'completed'));
    const retryIds = cancelled.files.filter((f) => f.status === 'cancelled').map((f) => f.fileId);
    assert.ok(retryIds.length);
    assert.equal(
      cancelled.files.filter((f) => f.status === 'failed').length,
      0,
      JSON.stringify(cancelled)
    );
    groupPlan = await prepare({ retryRunId: 'heavy-cancel', fileIds: retryIds });
    const retried = await service.applyGroupExport({
      planId: groupPlan.planId,
      workspaceRevision: groupPlan.workspaceRevision,
      runId: 'heavy-retry'
    });
    assert.ok(
      retried.files.every((f) => f.status === 'completed'),
      JSON.stringify(retried)
    );
    checks.push(
      '512MiB actual whole-batch read; export/cancel/selective retry verified every file PASS'
    );
    console.log(
      JSON.stringify(
        {
          os: process.platform,
          arch: process.arch,
          checks,
          heavyFiles: heavy.length,
          heavyCancelled: retryIds.length,
          cancelSettledMs,
          elapsedSeconds: (Date.now() - start) / 1000,
          peakParentAndDirectChildRssMiB: Math.ceil(peak / 1048576),
          maxNodeEventLoopGapMs: Math.round(maxGap),
          limitations:
            '512MiB and 50MiB use valid tiny PNGs with ancillary padding; geometry stress is the separate 40MP case. GUI responsiveness measured separately; these are not every camera/ICC/entropy combination.'
        },
        null,
        2
      )
    );
  } finally {
    clearInterval(timer);
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
