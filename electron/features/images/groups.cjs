const { randomUUID } = require('node:crypto');
const {
  emptyWorkspace,
  validateWorkspace,
  validateWorkspaceOperations,
  createWorkspaceResolver,
  validName
} = require('../../../shared/image-workspace.mjs');
function createGroupStore({ store } = {}) {
  // Additive KV schema: existing presets, registry and settings are never rewritten.
  const saved = store?.get('metadata:workspace');
  let workspace = saved ? validateWorkspace(saved) : emptyWorkspace();
  workspace.membership = {};
  workspace.overrides = {};
  workspace.selection = [];
  workspace.destinationByGroup = {};
  let resolver = null;
  const snapshot = () => structuredClone(workspace);
  const mutate = (fn) => {
    const next = snapshot();
    fn(next);
    next.revision++;
    workspace = validateWorkspace(next);
    resolver = null;
    return snapshot();
  };
  const group = (w, id) => {
    const found = w.groups.find((g) => g.id === id);
    if (!found) throw Error('INVALID_GROUP');
    return found;
  };
  return {
    snapshot,
    createGroup({ name }) {
      if (!validName(name)) throw Error('INVALID_GROUP_NAME');
      const g = { id: randomUUID(), name, operations: [] };
      mutate((w) => w.groups.push(g));
      return structuredClone(g);
    },
    renameGroup({ groupId, name }) {
      return mutate((w) => {
        if (!validName(name)) throw Error('INVALID_GROUP_NAME');
        group(w, groupId).name = name;
      });
    },
    removeGroup({ groupId, moveTo, confirmed }) {
      if (groupId === 'ungrouped' || moveTo !== 'ungrouped' || confirmed !== true)
        throw Error('GROUP_CONFIRMATION_REQUIRED');
      return mutate((w) => {
        group(w, groupId);
        w.groups = w.groups.filter((g) => g.id !== groupId);
        for (const id of Object.keys(w.membership))
          if (w.membership[id] === groupId) w.membership[id] = 'ungrouped';
        delete w.destinationByGroup[groupId];
      });
    },
    addFiles(ids) {
      return mutate((w) => {
        for (const id of ids) {
          if (Object.hasOwn(w.membership, id)) throw Error('DUPLICATE_FILE');
          w.membership[id] = 'ungrouped';
        }
      });
    },
    removeFile(id) {
      return mutate((w) => {
        if (!Object.hasOwn(w.membership, id)) throw Error('INVALID_FILE_TOKEN');
        delete w.membership[id];
        delete w.overrides[id];
        w.selection = w.selection.filter((x) => x !== id);
      });
    },
    clearFiles() {
      return mutate((w) => {
        w.membership = {};
        w.overrides = {};
        w.selection = [];
        w.destinationByGroup = {};
      });
    },
    moveFiles({ fileIds, targetGroupId }) {
      return mutate((w) => {
        group(w, targetGroupId);
        if (!Array.isArray(fileIds)) throw Error('INVALID_FILE_TOKEN');
        for (const id of fileIds) {
          if (!Object.hasOwn(w.membership, id)) throw Error('INVALID_FILE_TOKEN');
          w.membership[id] = targetGroupId;
        }
      });
    },
    setGroupOperations({ groupId, operations }) {
      return mutate((w) => {
        group(w, groupId).operations = validateWorkspaceOperations(operations);
      });
    },
    setFileOverrides({ fileId, overrides }) {
      return mutate((w) => {
        if (!Object.hasOwn(w.membership, fileId)) throw Error('INVALID_FILE_TOKEN');
        w.overrides[fileId] = validateWorkspaceOperations(overrides, { allowInherit: true });
      });
    },
    setGeneratedGPS({ updates }) {
      return mutate((w) => {
        if (
          !Array.isArray(updates) ||
          new Set(updates.map((u) => u.fileId)).size !== updates.length
        )
          throw Error('INVALID_FILE_TOKEN');
        for (const { fileId, operation } of updates) {
          if (
            !Object.hasOwn(w.membership, fileId) ||
            operation.field !== 'gps' ||
            operation.action !== 'set' ||
            operation.origin?.kind !== 'geo'
          )
            throw Error('INVALID_FILE_TOKEN');
          const clean = validateWorkspaceOperations([operation]);
          w.overrides[fileId] = [
            ...(w.overrides[fileId] || []).filter((o) => o.field !== 'gps'),
            ...clean
          ];
        }
      });
    },
    select({ fileIds }) {
      return mutate((w) => {
        w.selection = fileIds;
      });
    },
    destinations({ destinationByGroup }) {
      return mutate((w) => {
        w.destinationByGroup = destinationByGroup;
      });
    },
    effective(fileId) {
      resolver ||= createWorkspaceResolver(workspace);
      return resolver(fileId);
    },
    save() {
      const saved = {
        ...snapshot(),
        membership: {},
        overrides: {},
        selection: [],
        destinationByGroup: {}
      };
      if (store) store.transaction(() => store.set('metadata:workspace', saved));
      return {
        saved: true,
        groups: saved.groups.length,
        fileAccess: 'requires_reselection',
        fileOverrides: 'session_only'
      };
    }
  };
}
module.exports = { createGroupStore };
