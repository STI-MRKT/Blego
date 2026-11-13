import { METADATA_FIELDS, IMAGE_LIMITS } from './metadata-contracts.mjs';
import { validateOperations } from './metadata-operations.mjs';
const fail = () => {
  throw Error('INVALID_IMAGE_WORKSPACE');
};
const record = (x) => x && typeof x === 'object' && !Array.isArray(x);
const keys = (x, allowed) => record(x) && Object.keys(x).every((k) => allowed.includes(k));
export const validId = (id) =>
  typeof id === 'string' &&
  /^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
  !['__proto__', 'prototype', 'constructor'].includes(id);
export const validName = (name) =>
  typeof name === 'string' &&
  name.trim().length > 0 &&
  name.length <= 100 &&
  !/[\x00-\x1f\x7f]/.test(name);
export function emptyWorkspace() {
  return {
    schemaVersion: 1,
    revision: 0,
    groups: [{ id: 'ungrouped', name: 'Без группы', operations: [] }],
    membership: {},
    overrides: {},
    selection: [],
    destinationByGroup: {}
  };
}
export function validateWorkspaceOperations(operations, { allowInherit = false } = {}) {
  if (
    !Array.isArray(operations) ||
    operations.length > METADATA_FIELDS.length ||
    new Set(operations.map((o) => o?.field)).size !== operations.length
  )
    fail();
  return operations.map((op) => {
    if (!keys(op, ['field', 'action', 'value', 'scope', 'origin'])) fail();
    if (op.action === 'inherit') {
      if (!allowInherit || !METADATA_FIELDS.includes(op.field) || Object.keys(op).length !== 2)
        fail();
      return structuredClone(op);
    }
    const { origin, ...base } = op;
    validateOperations([base]);
    if (op.action === 'set' && !origin) throw Error('METADATA_ORIGIN_REQUIRED');
    if (origin) {
      if (
        !keys(origin, ['kind', 'id', 'name', 'sourceHash', 'version']) ||
        !['manual', 'preset', 'reference'].includes(origin.kind)
      )
        fail();
      if (origin.kind === 'manual' && Object.keys(origin).length !== 1) fail();
      if (origin.kind !== 'manual' && (!validId(origin.id) || !validName(origin.name))) fail();
      if (origin.kind === 'reference' && !/^[a-f0-9]{64}$/.test(origin.sourceHash || '')) fail();
      if (
        origin.version !== undefined &&
        (!Number.isSafeInteger(origin.version) || origin.version < 1)
      )
        fail();
    }
    return structuredClone(op);
  });
}
export function validateWorkspace(value) {
  if (
    !keys(value, [
      'schemaVersion',
      'revision',
      'groups',
      'membership',
      'overrides',
      'selection',
      'destinationByGroup'
    ]) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    JSON.stringify(value).length > 2 * 1024 * 1024
  )
    fail();
  const w = structuredClone(value);
  if (
    !Array.isArray(w.groups) ||
    !w.groups.length ||
    w.groups.length > 100 ||
    new Set(w.groups.map((g) => g?.id)).size !== w.groups.length
  )
    fail();
  for (const group of w.groups) {
    if (!keys(group, ['id', 'name', 'operations']) || !validId(group.id) || !validName(group.name))
      fail();
    group.operations = validateWorkspaceOperations(group.operations);
  }
  const ids = new Set(w.groups.map((g) => g.id));
  if (!ids.has('ungrouped')) fail();
  if (
    !record(w.membership) ||
    Object.keys(w.membership).length > IMAGE_LIMITS.files ||
    !record(w.overrides) ||
    !record(w.destinationByGroup)
  )
    fail();
  for (const [fileId, groupId] of Object.entries(w.membership))
    if (!validId(fileId) || !ids.has(groupId)) fail();
  for (const [fileId, overrides] of Object.entries(w.overrides)) {
    if (!Object.hasOwn(w.membership, fileId)) fail();
    w.overrides[fileId] = validateWorkspaceOperations(overrides, { allowInherit: true });
  }
  if (
    !Array.isArray(w.selection) ||
    new Set(w.selection).size !== w.selection.length ||
    w.selection.some((id) => !Object.hasOwn(w.membership, id))
  )
    fail();
  for (const [groupId, token] of Object.entries(w.destinationByGroup))
    if (!ids.has(groupId) || !validId(token)) fail();
  return w;
}
export function resolveFileOperations(workspace, fileId) {
  const w = validateWorkspace(workspace);
  if (!Object.hasOwn(w.membership, fileId)) throw Error('INVALID_FILE_TOKEN');
  const group = w.groups.find((g) => g.id === w.membership[fileId]),
    overrides = new Map((w.overrides[fileId] || []).map((o) => [o.field, o]));
  return METADATA_FIELDS.map((field) => {
    const own = overrides.get(field);
    return structuredClone(
      own && own.action !== 'inherit'
        ? own
        : group.operations.find((o) => o.field === field) || { field, action: 'keep' }
    );
  });
}
export const engineOperations = (operations) =>
  operations.map(({ origin, ...operation }) => operation);
