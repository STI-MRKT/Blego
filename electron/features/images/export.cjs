const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { readBounded } = require('./files.cjs');
const { inspectStructure, decodeHash } = require('./structure.cjs');
const { verifyTags } = require('./write-policy.cjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const abort = (signal) => {
  if (signal.aborted) throw Error('CANCELLED');
};
async function exportCopy({
  item,
  planned,
  operations,
  destination,
  engine,
  signal,
  onProgress,
  store,
  hooks = {}
}) {
  const base = { fileId: item.fileId, name: item.name };
  let dir;
  const progress = (status) => onProgress?.({ ...base, status });
  try {
    abort(signal);
    const original = await readBounded(item.path);
    if (digest(original) !== planned.sourceHash) throw Error('SOURCE_CHANGED');
    if (!operations.some((op) => op.action !== 'keep')) return { ...base, status: 'no_changes' };
    progress('writing');
    dir = await fs.promises.mkdtemp(path.join(destination, '.blego-meta-'));
    const marker = randomUUID();
    await fs.promises.writeFile(path.join(dir, 'owner.json'), JSON.stringify({ marker }), {
      flag: 'wx',
      mode: 0o600
    });
    if (store)
      store.set('metadata:pending', { ...(store.get('metadata:pending') || {}), [dir]: marker });
    const temporary = path.join(dir, `copy${path.extname(item.path).toLowerCase()}`);
    await fs.promises.writeFile(temporary, original, { flag: 'wx', mode: 0o600 });
    await hooks.beforeWrite?.(temporary);
    abort(signal);
    const written = await engine.writeCopy(temporary, operations, item.view.detectedFormat, {
      before: item.raw,
      signal
    });
    abort(signal);
    progress('verifying');
    const raw = await engine.read(temporary, { signal });
    const output = await readBounded(temporary),
      structure = inspectStructure(output),
      decoded = await decodeHash(temporary);
    if (
      structure.protectedHash !== item.structure.protectedHash ||
      !isDeepStrictEqual(decoded, item.view.imageInfo)
    )
      throw Error('METADATA_VERIFY_IMAGE');
    verifyTags(operations, item.raw, raw.tags);
    if (digest(await readBounded(item.path)) !== planned.sourceHash) throw Error('SOURCE_CHANGED');
    abort(signal);
    const handle = await fs.promises.open(temporary, 'r+');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    const stem =
      path
        .basename(item.name, path.extname(item.name))
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .slice(0, 70) || 'image';
    let outputName;
    for (let attempt = 0; attempt < 5; attempt++) {
      outputName = `${stem}_meta_${new Date().toISOString().replace(/[:.]/g, '-')}__${randomUUID().slice(0, 8)}${path.extname(item.name).toLowerCase()}`;
      try {
        await hooks.beforePublish?.();
        abort(signal);
        await fs.promises.link(temporary, path.join(destination, outputName));
        break;
      } catch (error) {
        if (error.code !== 'EEXIST' || attempt === 4) throw error;
      }
    }
    // link is exclusive: an existing destination can never be replaced. Verified copies survive cancellation.
    if (process.platform !== 'win32') {
      const d = await fs.promises.open(destination, 'r');
      try {
        await d.sync();
      } finally {
        await d.close();
      }
    }
    return {
      ...base,
      status: 'completed',
      outputName,
      outputHash: digest(output),
      sourceHash: planned.sourceHash,
      warnings: [
        ...item.view.warnings,
        ...(written.warning || raw.warning ? ['ENGINE_WARNING_REVIEW_REQUIRED'] : [])
      ]
    };
  } catch (error) {
    return {
      ...base,
      status: signal.aborted ? 'cancelled' : 'failed',
      error: signal.aborted
        ? 'CANCELLED'
        : /^(?:SOURCE_CHANGED|METADATA_|IMAGE_|CANCELLED)/.test(error.message)
          ? error.message
          : ['EACCES', 'EPERM', 'ENOSPC', 'EEXIST'].includes(error.code)
            ? error.code
            : 'METADATA_EXPORT_FAILED'
    };
  } finally {
    if (dir) {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
      if (store) {
        const pending = store.get('metadata:pending') || {};
        if (!fs.existsSync(dir)) {
          delete pending[dir];
          store.set('metadata:pending', pending);
        }
      }
    }
  }
}
async function recoverExports(store) {
  const pending = store?.get('metadata:pending') || {};
  for (const [dir, marker] of Object.entries(pending)) {
    try {
      const stat = await fs.promises.lstat(dir);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        !path.basename(dir).startsWith('.blego-meta-')
      )
        continue;
      const owner = JSON.parse(await fs.promises.readFile(path.join(dir, 'owner.json'), 'utf8'));
      if (owner.marker !== marker) continue;
      await fs.promises.rm(dir, { recursive: true });
      delete pending[dir];
    } catch (e) {
      if (e.code === 'ENOENT') delete pending[dir];
    }
  }
  if (store) store.set('metadata:pending', pending);
}
module.exports = { exportCopy, recoverExports };
