const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
const { createEngine } = require('./engine.cjs');
const { inspectStructure, decodeHash } = require('./structure.cjs');
const { validateOperations, viewTags, warnings } = require('./policy.cjs');
const { readBounded } = require('./files.cjs');
function createImageService({ engine = createEngine(), store, hooks = {} } = {}) {
  const destinations = new Map();
  let active = null;
  const files = new Map(),
    plans = new Map();
  let totalBytes = 0,
    running = 0;
  const waiting = [];
  const presets = new Map([
    ['privacy-v1', require('../../../resources/metadata-presets/privacy-v1.json')],
    ...Object.entries(store?.get('metadata:presets') || {})
  ]);
  async function withSlot(operation) {
    if (waiting.length >= IMAGE_LIMITS.files) throw Error('IMAGE_QUEUE_LIMIT');
    if (running >= IMAGE_LIMITS.parallel) await new Promise((resolve) => waiting.push(resolve));
    else running++;
    try {
      return await operation();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  }
  return {
    async recover() {
      await require('./export.cjs').recoverExports(store);
    },
    async addDestination(directory) {
      const stat = await fs.promises.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('INVALID_DESTINATION');
      const token = randomUUID();
      destinations.set(token, { path: path.resolve(directory), dev: stat.dev, ino: stat.ino });
      return token;
    },
    cancelExport() {
      active?.abort();
    },
    async applyMetadataPlan({ planId, destinationToken }, onProgress) {
      if (active || running) throw Error('IMAGES_BUSY');
      const plan = plans.get(planId),
        destination = destinations.get(destinationToken);
      if (!plan) throw Error('INVALID_PLAN_TOKEN');
      if (!destination) throw Error('INVALID_DESTINATION');
      const stat = await fs.promises.lstat(destination.path);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        stat.dev !== destination.dev ||
        stat.ino !== destination.ino
      )
        throw Error('INVALID_DESTINATION');
      const controller = new AbortController();
      active = controller;
      const results = new Array(plan.files.length);
      let next = 0;
      const worker = async () => {
        while (next < plan.files.length) {
          const index = next++,
            planned = plan.files[index],
            item = files.get(planned.fileId);
          results[index] = await require('./export.cjs').exportCopy({
            item,
            planned,
            operations: plan.operations,
            destination: destination.path,
            engine,
            signal: controller.signal,
            onProgress,
            store,
            hooks
          });
          onProgress?.(results[index]);
        }
      };
      try {
        await Promise.all(
          Array.from({ length: Math.min(IMAGE_LIMITS.parallel, plan.files.length) }, worker)
        );
        return { planId, files: results, cancelled: controller.signal.aborted };
      } finally {
        active = null;
        plans.delete(planId);
        destinations.delete(destinationToken);
      }
    },
    async addFiles(paths) {
      if (active) throw Error('IMAGES_BUSY');
      if (!Array.isArray(paths) || paths.length + files.size > IMAGE_LIMITS.files)
        throw Error('IMAGE_QUEUE_LIMIT');
      const pending = [];
      let added = 0;
      for (const file of paths) {
        const stat = await fs.promises.lstat(file);
        if (!stat.isFile() || stat.size > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
        added += stat.size;
        pending.push({
          fileId: randomUUID(),
          path: path.resolve(file),
          name: path.basename(file),
          size: stat.size,
          status: 'queued'
        });
      }
      if (totalBytes + added > IMAGE_LIMITS.totalBytes) throw Error('IMAGE_QUEUE_LIMIT');
      for (const item of pending) files.set(item.fileId, item);
      totalBytes += added;
      return pending.map(({ fileId, name, size, status }) => ({ fileId, name, size, status }));
    },
    async readImageMetadata(fileToken) {
      return withSlot(async () => {
        const item = files.get(fileToken);
        if (!item) throw Error('INVALID_FILE_TOKEN');
        const bytes = await readBounded(item.path);
        const structure = inspectStructure(bytes);
        const valid = { jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp'] };
        if (!valid[structure.format].includes(path.extname(item.path).toLowerCase()))
          throw Error('FORMAT_EXTENSION_MISMATCH');
        const raw = await engine.read(item.path);
        const imageInfo = await decodeHash(item.path);
        const sourceHash = createHash('sha256').update(bytes).digest('hex');
        const after = createHash('sha256')
          .update(await readBounded(item.path))
          .digest('hex');
        if (after !== sourceHash) throw Error('SOURCE_CHANGED');
        const signed =
          structure.signed ||
          Object.keys(raw.tags).some((key) => /JUMBF|C2PA|ContentCredential/i.test(key));
        const view = {
          fileId: item.fileId,
          name: item.name,
          size: bytes.length,
          sourceHash,
          detectedFormat: structure.format,
          imageInfo,
          tags: viewTags(raw.tags),
          capabilities: { writable: !signed },
          warnings: [
            ...warnings(raw.tags),
            ...(signed ? ['SIGNED_PROVENANCE_UNSUPPORTED'] : []),
            ...(raw.warning ? ['ENGINE_READ_WARNING'] : [])
          ],
          status: 'ready'
        };
        item.view = view;
        item.raw = raw.tags;
        item.structure = structure;
        return structuredClone(view);
      });
    },
    clear() {
      if (running || active) throw Error('IMAGES_BUSY');
      files.clear();
      plans.clear();
      totalBytes = 0;
    },
    remove(id) {
      if (running || active) throw Error('IMAGES_BUSY');
      const item = files.get(id);
      if (!item) throw Error('INVALID_FILE_TOKEN');
      totalBytes -= item.size;
      files.delete(id);
      plans.clear();
    },
    presets() {
      return [...presets].map(([id, preset]) => ({ id, ...preset }));
    },
    importPreset(preset) {
      if (
        !preset ||
        Object.keys(preset).some(
          (key) => !['schemaVersion', 'name', 'operations', 'notice'].includes(key)
        ) ||
        preset.schemaVersion !== 1 ||
        typeof preset.name !== 'string' ||
        !preset.name ||
        preset.name.length > 100
      )
        throw Error('METADATA_INVALID_PRESET');
      const clean = {
        schemaVersion: 1,
        name: preset.name,
        operations: validateOperations(preset.operations)
      };
      const id = randomUUID();
      presets.set(id, clean);
      if (store)
        store.set(
          'metadata:presets',
          Object.fromEntries([...presets].filter(([key]) => key !== 'privacy-v1'))
        );
      return { id, ...clean };
    },
    async preview(fileId) {
      const item = files.get(fileId);
      if (!item?.view) throw Error('INVALID_FILE_TOKEN');
      const bytes = await readBounded(item.path);
      if (createHash('sha256').update(bytes).digest('hex') !== item.view.sourceHash)
        throw Error('SOURCE_CHANGED');
      return `data:image/${item.view.detectedFormat};base64,${bytes.toString('base64')}`;
    },
    planMetadataChanges({ fileIds, operations, presetId, acknowledgeMakerNotes = false }) {
      if (!Array.isArray(fileIds) || !fileIds.length || fileIds.length > IMAGE_LIMITS.files)
        throw Error('INVALID_FILE_TOKEN');
      if (presetId !== undefined) {
        if (!presets.has(presetId) || operations?.length)
          throw Error('METADATA_PRESET_UNSUPPORTED');
        operations = presets.get(presetId).operations;
      }
      if (plans.size >= 20) plans.delete(plans.keys().next().value);
      const clean = validateOperations(operations);
      const output = [];
      for (const id of new Set(fileIds)) {
        const item = files.get(id);
        if (!item?.view) throw Error('INVALID_FILE_TOKEN');
        if (!item.view.capabilities.writable) throw Error('SIGNED_PROVENANCE_UNSUPPORTED');
        if (
          !acknowledgeMakerNotes &&
          item.view.warnings.includes('MAKER_NOTES_PRESENT') &&
          clean.some((op) => ['make', 'model'].includes(op.field) && op.action !== 'keep')
        )
          throw Error('MAKER_NOTES_CONFIRMATION_REQUIRED');
        output.push({
          fileId: id,
          name: item.name,
          sourceHash: item.view.sourceHash,
          warnings: item.view.warnings,
          beforeAfter: clean.map((op) => ({
            field: op.field,
            operation: op.action,
            before: item.view.tags.find((tag) => tag.field === op.field).value,
            after:
              op.action === 'keep'
                ? item.view.tags.find((tag) => tag.field === op.field).value
                : op.action === 'remove'
                  ? null
                  : op.value,
            supported: true
          }))
        });
      }
      const plan = {
        planId: randomUUID(),
        planVersion: 1,
        files: output,
        operations: clean,
        unsupported: [],
        warnings: [...new Set(output.flatMap((file) => file.warnings))]
      };
      plans.set(plan.planId, plan);
      return structuredClone(plan);
    }
  };
}
module.exports = { createImageService };
