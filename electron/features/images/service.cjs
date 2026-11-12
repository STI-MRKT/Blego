const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
const { createEngine } = require('./engine.cjs');
const { inspectStructure, decodeHash } = require('./structure.cjs');
const { validateOperations, viewTags, warnings } = require('./policy.cjs');
const { readBounded } = require('./files.cjs');
function createImageService({ engine = createEngine(), store, hooks = {} } = {}) {
  const groupStore = require('./groups.cjs').createGroupStore({ store });
  const groups = Object.fromEntries(
    Object.entries(groupStore).map(([name, fn]) => [
      name,
      (...args) => {
        if ((active || adding) && !['snapshot', 'effective'].includes(name))
          throw Error('IMAGES_BUSY');
        return fn(...args);
      }
    ])
  );
  const runs = new Map(),
    history = new Map(),
    planRuns = new Map();
  let groupRun = null;
  const references = new Map();
  const destinations = new Map();
  const readers = new Set();
  let active = null,
    adding = false;
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
  async function checkDestination(token, probe = false) {
    const destination = destinations.get(token);
    if (!destination) throw Error('INVALID_DESTINATION');
    const stat = await fs.promises.lstat(destination.path);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.dev !== destination.dev ||
      stat.ino !== destination.ino
    )
      throw Error('INVALID_DESTINATION');
    if (probe) {
      const dir = await fs.promises.mkdtemp(path.join(destination.path, '.blego-check-'));
      try {
        await fs.promises.writeFile(path.join(dir, 'probe'), 'probe', { flag: 'wx', mode: 0o600 });
        await fs.promises.link(path.join(dir, 'probe'), path.join(dir, 'link'));
      } catch {
        throw Error('DESTINATION_EXCLUSIVE_LINK_UNSUPPORTED');
      } finally {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  }
  return {
    groups,
    async recover() {
      await require('./export.cjs').recoverExports(store);
    },
    async addDestination(directory) {
      const stat = await fs.promises.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('INVALID_DESTINATION');
      if (destinations.size >= 100) destinations.delete(destinations.keys().next().value);
      const token = randomUUID();
      destinations.set(token, { path: path.resolve(directory), dev: stat.dev, ino: stat.ino });
      return token;
    },
    cancelReads() {
      for (const controller of readers) controller.abort();
    },
    cancelExport() {
      active?.abort();
    },
    async applyMetadataPlan({ planId, destinationToken }, onProgress) {
      if (active || running || adding) throw Error('IMAGES_BUSY');
      const plan = plans.get(planId);
      if (!plan) throw Error('INVALID_PLAN_TOKEN');
      // Acquire before the first await: IPC/UI double-clicks cannot race the destination check.
      const controller = new AbortController();
      active = controller;
      const selectedDestinations =
        plan.planVersion === 2 ? plan.destinationByGroup : { legacy: destinationToken };
      let started = false;
      const results = new Array(plan.files.length);
      let next = 0;
      try {
        try {
          if (plan.planVersion === 2) {
            if (groups.snapshot().revision !== plan.workspaceRevision) throw Error('PLAN_STALE');
            for (const planned of plan.files) {
              const item = files.get(planned.fileId);
              if (
                !item ||
                createHash('sha256')
                  .update(await readBounded(item.path))
                  .digest('hex') !== planned.sourceHash
              )
                throw Error('PLAN_STALE');
              await this.verifyOrigins(planned.operations);
            }
          }
          for (const token of new Set(Object.values(selectedDestinations)))
            await checkDestination(token);
        } catch (error) {
          if (plan.planVersion === 2) throw Error('PLAN_STALE');
          throw error;
        }
        started = true;
        const worker = async () => {
          while (next < plan.files.length) {
            const index = next++,
              planned = plan.files[index],
              item = files.get(planned.fileId);
            const operations = planned.operations || plan.operations;
            const destination = destinations.get(selectedDestinations[planned.groupId || 'legacy']);
            const signal = groupRun
              ? AbortSignal.any([
                  controller.signal,
                  groupRun.controllers.get(planned.groupId).signal
                ])
              : controller.signal;
            const emit = (result) =>
              onProgress?.({
                ...result,
                ...(groupRun
                  ? {
                      runId: groupRun.runId,
                      groupId: planned.groupId,
                      groupName: planned.groupName
                    }
                  : {})
              });
            const startedAt = new Date().toISOString();
            const result = await require('./export.cjs').exportCopy({
              item,
              planned,
              operations: require('../../../shared/image-workspace.mjs').engineOperations(
                operations
              ),
              destination: destination.path,
              engine,
              signal,
              onProgress: emit,
              store,
              hooks
            });
            results[index] = {
              ...result,
              ...(plan.planVersion === 2
                ? {
                    groupId: planned.groupId,
                    groupName: planned.groupName,
                    startedAt,
                    finishedAt: new Date().toISOString(),
                    changedFields: operations
                      .filter((op) => op.action !== 'keep')
                      .map((op) => op.field),
                    verification:
                      result.status === 'completed'
                        ? 'readback_and_pixels'
                        : result.status === 'no_changes'
                          ? 'not_needed'
                          : 'not_completed'
                  }
                : {})
            };
            emit(results[index]);
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(IMAGE_LIMITS.parallel, plan.files.length) }, worker)
        );
        return {
          planId,
          ...(groupRun ? { runId: groupRun.runId } : {}),
          files: results,
          cancelled: controller.signal.aborted
        };
      } finally {
        active = null;
        if (started || plan.planVersion === 2) plans.delete(planId);
      }
    },
    async verifyOrigins(operations) {
      for (const op of operations) {
        if (op.origin?.kind === 'reference') {
          let expected;
          try {
            expected = await this.referenceOperations({
              referenceId: references.has(op.origin.id)
                ? op.origin.id
                : [...references].find(
                    ([, ref]) =>
                      ref.sourceHash === op.origin.sourceHash && ref.name === op.origin.name
                  )?.[0],
              fields: [op.field]
            });
          } catch {
            throw Error('PLAN_STALE');
          }
          if (
            !expected.length ||
            !require('node:util').isDeepStrictEqual(
              { ...expected[0], origin: { ...expected[0].origin, id: op.origin.id } },
              op
            )
          )
            throw Error('PLAN_STALE');
        } // Preset operations are immutable user-applied snapshots, independent of later library edits.
      }
    },
    async prepareGroupExport({
      scope,
      groupId,
      workspaceRevision,
      destinationByGroup,
      retryRunId,
      fileIds,
      acknowledgeMakerNotes = false
    }) {
      if (active || running || adding) throw Error('IMAGES_BUSY');
      const workspace = groups.snapshot();
      if (workspaceRevision !== workspace.revision) throw Error('PLAN_STALE');
      let ids =
        scope === 'selection'
          ? workspace.selection
          : scope === 'group'
            ? Object.keys(workspace.membership).filter((id) => workspace.membership[id] === groupId)
            : scope === 'all'
              ? Object.keys(workspace.membership)
              : null;
      if (!ids || !ids.length) throw Error('INVALID_EXPORT_SCOPE');
      if (retryRunId !== undefined) {
        const old = history.get(retryRunId);
        if (
          !old ||
          !Array.isArray(fileIds) ||
          !fileIds.length ||
          new Set(fileIds).size !== fileIds.length ||
          fileIds.some(
            (id) =>
              !ids.includes(id) ||
              !old.files.some((f) => f.fileId === id && ['failed', 'cancelled'].includes(f.status))
          )
        )
          throw Error('INVALID_RETRY');
        ids = fileIds;
        for (const id of ids) await this.readImageMetadata(id);
      } else if (fileIds !== undefined) throw Error('INVALID_EXPORT_SCOPE');
      if (
        !destinationByGroup ||
        typeof destinationByGroup !== 'object' ||
        Array.isArray(destinationByGroup) ||
        Object.keys(destinationByGroup).some((id) => !workspace.groups.some((g) => g.id === id))
      )
        throw Error('INVALID_DESTINATION');
      const output = [];
      const used = {};
      for (const id of ids) {
        const gid = workspace.membership[id],
          token = destinationByGroup[gid];
        if (!destinations.has(token)) throw Error('INVALID_DESTINATION');
        used[gid] = token;
        const operations = groups.effective(id);
        await this.verifyOrigins(operations);
        const legacy = this.planMetadataChanges({
          fileIds: [id],
          operations: require('../../../shared/image-workspace.mjs').engineOperations(operations),
          acknowledgeMakerNotes
        });
        plans.delete(legacy.planId);
        const item = files.get(id);
        if (
          createHash('sha256')
            .update(await readBounded(item.path))
            .digest('hex') !== item.view.sourceHash
        )
          throw Error('PLAN_STALE');
        output.push({
          ...legacy.files[0],
          groupId: gid,
          groupName: workspace.groups.find((g) => g.id === gid).name,
          destinationName: path.basename(destinations.get(token).path),
          operations
        });
      }
      for (const token of new Set(Object.values(used))) await checkDestination(token, true);
      if (groups.snapshot().revision !== workspaceRevision) throw Error('PLAN_STALE');
      const plan = {
        planId: randomUUID(),
        planVersion: 2,
        workspaceRevision,
        scope,
        destinationByGroup: used,
        files: output,
        warnings: [...new Set(output.flatMap((f) => f.warnings))],
        ...(retryRunId ? { retryRunId } : {})
      };
      if (plans.size >= 20) plans.delete(plans.keys().next().value);
      plans.set(plan.planId, plan);
      return structuredClone(plan);
    },
    applyGroupExport({ planId, workspaceRevision, runId }, onProgress) {
      if (!require('../../../shared/image-workspace.mjs').validId(runId))
        return Promise.reject(Error('INVALID_RUN_ID'));
      const existing = runs.get(runId);
      if (existing)
        return existing.planId === planId && existing.revision === workspaceRevision
          ? existing.promise
          : Promise.reject(Error('RUN_ID_REUSED'));
      const previous = planRuns.get(planId);
      if (previous)
        return previous.revision === workspaceRevision
          ? previous.promise
          : Promise.reject(Error('PLAN_STALE'));
      const plan = plans.get(planId);
      if (
        !plan ||
        plan.planVersion !== 2 ||
        plan.workspaceRevision !== workspaceRevision ||
        groups.snapshot().revision !== workspaceRevision
      )
        return Promise.reject(Error('PLAN_STALE'));
      if (active || running || adding || groupRun) return Promise.reject(Error('IMAGES_BUSY'));
      groupRun = {
        runId,
        controllers: new Map(plan.files.map((f) => [f.groupId, new AbortController()]))
      };
      const promise = this.applyMetadataPlan({ planId }, onProgress)
        .then((report) => {
          history.set(runId, structuredClone(report));
          return report;
        })
        .finally(() => {
          groupRun = null;
        });
      const entry = { planId, revision: workspaceRevision, promise };
      runs.set(runId, entry);
      planRuns.set(planId, entry);
      if (runs.size > 100) {
        const old = runs.keys().next().value;
        const item = runs.get(old);
        runs.delete(old);
        planRuns.delete(item.planId);
        history.delete(old);
      }
      return promise;
    },
    cancelGroupExport({ runId, groupId }) {
      if (groupRun?.runId !== runId) return false;
      if (groupId === undefined) active?.abort();
      else {
        const controller = groupRun.controllers.get(groupId);
        if (!controller) return false;
        controller.abort();
      }
      return true;
    },
    exportHistory() {
      return [...history.values()].map((x) => structuredClone(x));
    },
    async addFiles(paths, { reference = false } = {}) {
      if (active || adding) throw Error('IMAGES_BUSY');
      adding = true;
      try {
        if (!Array.isArray(paths) || paths.length > 1000) throw Error('IMAGE_QUEUE_LIMIT');
        const pending = [],
          promoted = [];
        let added = 0;
        const known = new Set([...files.values()].map((item) => item.path));
        for (const file of paths) {
          const canonical = await fs.promises.realpath(file);
          if (known.has(canonical)) {
            const existing = [...files.values()].find((item) => item.path === canonical);
            if (!reference && existing?.reference && !promoted.includes(existing))
              promoted.push(existing);
            continue;
          }
          known.add(canonical);
          const stat = await fs.promises.lstat(file);
          if (!stat.isFile() || stat.size > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
          added += stat.size;
          pending.push({
            fileId: randomUUID(),
            path: canonical,
            reference,
            name: path.basename(file),
            size: stat.size,
            status: 'queued'
          });
        }
        if (
          pending.length + files.size > IMAGE_LIMITS.files ||
          totalBytes + added > IMAGE_LIMITS.totalBytes
        )
          throw Error('IMAGE_QUEUE_LIMIT');
        if (!reference && (pending.length || promoted.length))
          groupStore.addFiles([...pending, ...promoted].map((x) => x.fileId));
        for (const item of promoted) item.reference = false;
        for (const item of pending) files.set(item.fileId, item);
        totalBytes += added;
        return [...pending, ...promoted].map(({ fileId, name, size, status }) => ({
          fileId,
          name,
          size,
          status
        }));
      } finally {
        adding = false;
      }
    },
    async readImageMetadata(fileToken) {
      if (active) throw Error('IMAGES_BUSY');
      const controller = new AbortController();
      readers.add(controller);
      const check = () => {
        if (controller.signal.aborted) throw Error('CANCELLED');
      };
      return withSlot(async () => {
        check();
        const item = files.get(fileToken);
        if (!item) throw Error('INVALID_FILE_TOKEN');
        const bytes = await readBounded(item.path);
        const delta = bytes.length - item.size;
        if (totalBytes + delta > IMAGE_LIMITS.totalBytes) throw Error('IMAGE_QUEUE_LIMIT');
        totalBytes += delta;
        item.size = bytes.length;
        const structure = inspectStructure(bytes);
        const valid = { jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp'] };
        if (!valid[structure.format].includes(path.extname(item.path).toLowerCase()))
          throw Error('FORMAT_EXTENSION_MISMATCH');
        check();
        const raw = await engine.read(item.path, { signal: controller.signal });
        check();
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
        check();
        item.view = view;
        item.raw = raw.tags;
        item.structure = structure;
        return structuredClone(view);
      }).finally(() => readers.delete(controller));
    },
    clear() {
      if (running || active || adding) throw Error('IMAGES_BUSY');
      files.clear();
      references.clear();
      groups.clearFiles();
      plans.clear();
      totalBytes = 0;
    },
    remove(id) {
      if (running || active || adding) throw Error('IMAGES_BUSY');
      const item = files.get(id);
      if (!item) throw Error('INVALID_FILE_TOKEN');
      totalBytes -= item.size;
      files.delete(id);
      references.delete(id);
      if (!item.reference) groups.removeFile(id);
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
    async addReference(file) {
      const added = await this.addFiles([file], { reference: true });
      const canonical = await fs.promises.realpath(file);
      const id = added[0]?.fileId || [...files.values()].find((x) => x.path === canonical)?.fileId;
      const view = await this.readImageMetadata(id);
      references.set(id, structuredClone(view));
      return {
        referenceId: id,
        name: view.name,
        sourceHash: view.sourceHash,
        tags: view.tags.filter((x) => x.field !== 'personalIdentifiers')
      };
    },
    async referenceOperations({ referenceId, fields: chosen }) {
      const reference = references.get(referenceId),
        item = files.get(referenceId);
      if (!reference || !item) throw Error('INVALID_REFERENCE_TOKEN');
      if (
        !Array.isArray(chosen) ||
        new Set(chosen).size !== chosen.length ||
        chosen.some(
          (field) =>
            !reference.tags.some((x) => x.field === field) || field === 'personalIdentifiers'
        )
      )
        throw Error('INVALID_REFERENCE_FIELD');
      if (
        createHash('sha256')
          .update(await readBounded(item.path))
          .digest('hex') !== reference.sourceHash
      )
        throw Error('SOURCE_CHANGED');
      return chosen.flatMap((field) => {
        const tag = reference.tags.find((x) => x.field === field);
        if (tag.referenceSupported === false) throw Error('METADATA_REFERENCE_UNSUPPORTED');
        const value = tag.value;
        return value == null
          ? []
          : [
              {
                field,
                action: 'set',
                value,
                origin: {
                  kind: 'reference',
                  id: referenceId,
                  name: reference.name,
                  sourceHash: reference.sourceHash
                }
              }
            ];
      });
    },
    managePreset({ action, id, name, confirmed }) {
      const preset = presets.get(id);
      if (!preset) throw Error('METADATA_PRESET_UNSUPPORTED');
      if (action === 'export') return structuredClone(preset);
      if (action === 'duplicate') return this.importPreset({ ...preset, name });
      if (id === 'privacy-v1') throw Error('PRESET_READ_ONLY');
      if (action === 'rename') {
        if (!require('../../../shared/image-workspace.mjs').validName(name))
          throw Error('INVALID_PRESET_NAME');
        presets.set(id, { ...preset, name });
      } else if (action === 'delete') {
        if (confirmed !== true) throw Error('PRESET_CONFIRMATION_REQUIRED');
        presets.delete(id);
      } else throw Error('INVALID_PRESET_ACTION');
      store?.set(
        'metadata:presets',
        Object.fromEntries([...presets].filter(([key]) => key !== 'privacy-v1'))
      );
      plans.clear();
      return action === 'delete' ? { deleted: true } : { id, ...presets.get(id) };
    },
    async clipboardPNG(fileId) {
      if (active) throw Error('IMAGES_BUSY');
      return withSlot(async () => {
        const item = files.get(fileId);
        if (!item?.view) throw Error('INVALID_FILE_TOKEN');
        const bytes = await readBounded(item.path);
        if (createHash('sha256').update(bytes).digest('hex') !== item.view.sourceHash)
          throw Error('SOURCE_CHANGED');
        // Pixel-only clipboard representation. Sharp strips metadata by default.
        return require('sharp')(bytes, { limitInputPixels: IMAGE_LIMITS.pixels, failOn: 'warning' })
          .rotate()
          .png()
          .toBuffer();
      });
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
