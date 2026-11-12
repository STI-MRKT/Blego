import { METADATA_FIELDS } from './metadata-contracts.mjs';
export function validateOperations(operations) {
  if (
    !Array.isArray(operations) ||
    operations.length > METADATA_FIELDS.length ||
    new Set(operations.map((op) => op?.field)).size !== operations.length
  )
    throw Error('METADATA_INVALID_OPERATION');
  const clean = structuredClone(operations);
  for (const op of clean) {
    if (
      !op ||
      Object.keys(op).some((key) => !['field', 'action', 'value'].includes(key)) ||
      !METADATA_FIELDS.includes(op.field) ||
      !['keep', 'set', 'remove'].includes(op.action)
    )
      throw Error('METADATA_INVALID_OPERATION');
    if (op.action !== 'set') {
      if (Object.hasOwn(op, 'value')) throw Error('METADATA_INVALID_OPERATION');
      continue;
    }
    if (op.field === 'personalIdentifiers') throw Error('METADATA_INVALID_OPERATION');
    const value = op.value;
    if (op.field === 'gps') {
      if (
        !value ||
        Object.keys(value).some((k) => !['latitude', 'longitude', 'altitude'].includes(k)) ||
        !Number.isFinite(value.latitude) ||
        Math.abs(value.latitude) > 90 ||
        !Number.isFinite(value.longitude) ||
        Math.abs(value.longitude) > 180 ||
        (value.altitude != null &&
          (!Number.isFinite(value.altitude) || Math.abs(value.altitude) > 100000))
      )
        throw Error('METADATA_INVALID_GPS');
    } else if (op.field === 'captureDate') {
      if (
        !value ||
        Object.keys(value).some((k) => !['local', 'offset'].includes(k)) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.local) ||
        !(value.offset == null || /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value.offset))
      )
        throw Error('METADATA_INVALID_DATE');
      const date = new Date(`${value.local}Z`);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 19) !== value.local ||
        /^[-+]14:(?!00)/.test(value.offset || '')
      )
        throw Error('METADATA_INVALID_DATE');
      value.offset ??= null;
    } else if (op.field === 'keywords') {
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.length > 100 ||
        value.some((x) => !validText(x))
      )
        throw Error('METADATA_INVALID_VALUE');
    } else if (!validText(value)) throw Error('METADATA_INVALID_VALUE');
  }
  return clean;
}
function validText(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 4000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}
