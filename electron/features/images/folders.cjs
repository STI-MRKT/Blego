const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
const supported = /\.(?:jpe?g|png|webp)$/iu;
const physicalKey = (stat, canonical) => (stat.ino ? `${stat.dev}:${stat.ino}` : canonical);
const fingerprint = (value) => createHash('sha256').update(value).digest('hex').slice(0, 8);
function safeComponent(value) {
  let clean = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, '_')
    .replace(/[. ]+$/u, '')
    .slice(0, 80);
  if (
    !clean ||
    /^\.+$/.test(clean) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(clean)
  )
    clean = '_' + clean;
  return clean === value ? clean : `${clean}_${fingerprint(value)}`;
}
async function scanInputs(paths, { signal, onProgress, reference = false } = {}) {
  if (
    !Array.isArray(paths) ||
    paths.length > IMAGE_LIMITS.files ||
    paths.some((p) => typeof p !== 'string' || !p || p.length > 4096)
  )
    throw Error('IMAGE_QUEUE_LIMIT');
  const files = [],
    known = new Set(),
    directories = new Set();
  const summary = {
    phase: 'scanning',
    found: 0,
    inspected: 0,
    skipped: 0,
    duplicates: 0,
    errors: []
  };
  const check = () => {
    if (signal?.aborted) throw Error('CANCELLED');
  };
  const emit = () => {
    onProgress?.({ ...summary, errors: [...summary.errors] });
    check();
  };
  async function visit(file, root, depth, direct = false) {
    check();
    if (++summary.inspected > 100000 || depth > 32) throw Error('IMAGE_SCAN_LIMIT');
    let stat;
    try {
      stat = await fs.promises.lstat(file);
    } catch (error) {
      if (direct) throw error;
      if (summary.errors.length < 100)
        summary.errors.push({
          name: path.basename(file),
          code: ['EACCES', 'EPERM', 'ENOENT'].includes(error.code)
            ? error.code
            : 'IMAGE_SCAN_FAILED'
        });
      summary.skipped++;
      return;
    }
    check();
    if (stat.isSymbolicLink()) {
      if (direct) throw Error('IMAGE_UNSUPPORTED_LINK');
      summary.skipped++;
      return;
    }
    if (stat.isDirectory()) {
      if (reference) throw Error('IMAGE_TOO_LARGE');
      const canonical = await fs.promises.realpath(file),
        key = physicalKey(stat, canonical);
      if (directories.has(key)) {
        summary.duplicates++;
        return;
      }
      directories.add(key);
      if (!root)
        root = {
          path: canonical,
          sourceFolder: path.basename(canonical),
          alias: `${safeComponent(path.basename(canonical))}_${fingerprint(canonical)}`
        };
      let entries;
      try {
        entries = await fs.promises.opendir(canonical);
      } catch (error) {
        if (direct) throw error;
        if (summary.errors.length < 100)
          summary.errors.push({
            name: path.basename(file),
            code: ['EACCES', 'EPERM'].includes(error.code) ? error.code : 'IMAGE_SCAN_FAILED'
          });
        summary.skipped++;
        return;
      }
      for await (const entry of entries)
        await visit(path.join(canonical, entry.name), root, depth + 1);
      return;
    }
    if (!stat.isFile() || (!direct && !supported.test(file))) {
      summary.skipped++;
      return;
    }
    const canonical = await fs.promises.realpath(file);
    if (
      root &&
      (path.relative(root.path, canonical).startsWith('..' + path.sep) ||
        path.isAbsolute(path.relative(root.path, canonical)))
    )
      throw Error('IMAGE_UNSAFE_SOURCE');
    const key = physicalKey(stat, canonical);
    if (known.has(key)) {
      summary.duplicates++;
      return;
    }
    known.add(key);
    if (stat.size > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
    if (files.length >= IMAGE_LIMITS.files) throw Error('IMAGE_QUEUE_LIMIT');
    const relative = root
      ? path.relative(root.path, canonical).split(path.sep).map(safeComponent)
      : [path.basename(canonical)];
    files.push({
      path: canonical,
      physicalKey: key,
      dev: stat.dev,
      ino: stat.ino,
      name: path.basename(file),
      size: stat.size,
      relativePath: root ? [root.alias, ...relative].join('/') : path.basename(file),
      sourceFolder: root?.sourceFolder || null
    });
    summary.found = files.length;
    emit();
  }
  emit();
  for (const file of paths) await visit(file, null, 0, true);
  check();
  summary.phase = 'complete';
  emit();
  return { files, summary };
}
// Every component is checked without following a symbolic link. Check again at
// publication time; the renderer never supplies this derived relative path.
async function exportDirectory(root, relativeDirectory) {
  const pieces = relativeDirectory ? relativeDirectory.split('/') : [];
  if (
    pieces.length > 33 ||
    pieces.some(
      (p) =>
        !p || p === '.' || p === '..' || p.includes('\\') || p.includes('\0') || path.isAbsolute(p)
    )
  )
    throw Error('METADATA_UNSAFE_DESTINATION');
  const identities = [];
  let current = path.resolve(root);
  async function capture(directory) {
    const stat = await fs.promises.lstat(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await fs.promises.realpath(directory)) !== directory
    )
      throw Error('METADATA_UNSAFE_DESTINATION');
    identities.push({ path: directory, dev: stat.dev, ino: stat.ino });
  }
  await capture(current);
  for (const piece of pieces) {
    current = path.join(current, piece);
    try {
      await fs.promises.mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await capture(current);
  }
  return {
    path: current,
    async verify() {
      for (const previous of identities) {
        const stat = await fs.promises.lstat(previous.path);
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          stat.dev !== previous.dev ||
          stat.ino !== previous.ino ||
          (await fs.promises.realpath(previous.path)) !== previous.path
        )
          throw Error('METADATA_UNSAFE_DESTINATION');
      }
    }
  };
}
module.exports = { scanInputs, physicalKey, safeComponent, exportDirectory };
