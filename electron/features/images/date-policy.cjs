// Date scope/value resolution for the existing writer; no separate engine or storage.
const { isDeepStrictEqual } = require('node:util');
const namespaces = ['exif', 'xmp'];
const scope = (op) => op.scope || namespaces;
// XMP timestamps can contain fractional seconds before an optional timezone.
const xmpOffset = (value) =>
  String(value)
    .slice(19)
    .replace(/^\.\d+/, '') || null;
function dateKeys(raw, namespace) {
  return Object.keys(raw).filter(
    (key) =>
      (namespace === 'xmp' ? /^XMP-exif:/.test(key) : /^(?:ExifIFD|EXIF):/.test(key)) &&
      /:(?:DateTimeOriginal|OffsetTimeOriginal)$/.test(key)
  );
}
function representation(raw, namespace) {
  const keys = dateKeys(raw, namespace),
    date = keys.find((k) => k.endsWith(':DateTimeOriginal'));
  if (!date) return null;
  const value = String(raw[date]);
  return {
    local: value.slice(0, 19).replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T'),
    offset:
      namespace === 'exif'
        ? raw[keys.find((k) => k.endsWith(':OffsetTimeOriginal'))] || null
        : xmpOffset(value)
  };
}
function expectedDate(op, before, namespace) {
  if (op.action === 'keep') return representation(before, namespace);
  if (op.action === 'remove') return null;
  const mode = op.value.offsetMode || (op.value.offset ? 'set' : 'remove');
  let offset = mode === 'set' ? op.value.offset : null;
  if (mode === 'keep') {
    const values = dateKeys(before, namespace)
      .filter((k) => k.endsWith(namespace === 'exif' ? ':OffsetTimeOriginal' : ':DateTimeOriginal'))
      .map((k) => (namespace === 'exif' ? String(before[k]) : xmpOffset(before[k])));
    if (new Set(values).size > 1) throw Error('METADATA_CONFLICTING_DATE_OFFSETS');
    offset = values[0] || null;
    if (offset !== null && !/^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(offset))
      throw Error('METADATA_INVALID_DATE');
  }
  return { local: op.value.local, offset };
}
function dateWriteArgs(op, before) {
  const args = [];
  for (const namespace of scope(op)) {
    const tags =
      namespace === 'exif'
        ? ['EXIF:DateTimeOriginal', 'EXIF:OffsetTimeOriginal']
        : ['XMP-exif:DateTimeOriginal'];
    for (const tag of tags) args.push(`-${tag}=`);
    const value = expectedDate(op, before, namespace);
    if (!value) continue;
    const local = value.local.replace(/^(\d{4})-(\d{2})-(\d{2})T/, '$1:$2:$3 ');
    if (namespace === 'exif') {
      args.push(`-EXIF:DateTimeOriginal=${local}`);
      if (value.offset) args.push(`-EXIF:OffsetTimeOriginal=${value.offset}`);
    } else args.push(`-XMP-exif:DateTimeOriginal=${local}${value.offset || ''}`);
  }
  return args;
}
function verifyDate(op, before, after) {
  for (const namespace of namespaces) {
    const values = (raw) => Object.fromEntries(dateKeys(raw, namespace).map((k) => [k, raw[k]]));
    if (op.action === 'keep' || !scope(op).includes(namespace)) {
      if (!isDeepStrictEqual(values(before), values(after)))
        throw Error('METADATA_VERIFY_DATE_UNSELECTED');
      continue;
    }
    const expected = expectedDate(op, before, namespace);
    if (!isDeepStrictEqual(representation(after, namespace), expected))
      throw Error('METADATA_VERIFY_CAPTUREDATE');
    if (op.action === 'remove' && dateKeys(after, namespace).length)
      throw Error('METADATA_VERIFY_DATE_DUPLICATES');
    for (const key of dateKeys(after, namespace)) {
      if (key.endsWith(':OffsetTimeOriginal')) {
        if (after[key] !== expected?.offset) throw Error('METADATA_VERIFY_DATE_DUPLICATES');
      } else {
        const one = representation(
          {
            [key]: after[key],
            ...(namespace === 'exif' && expected?.offset
              ? { 'ExifIFD:OffsetTimeOriginal': expected.offset }
              : {})
          },
          namespace
        );
        if (!isDeepStrictEqual(one, expected)) throw Error('METADATA_VERIFY_DATE_DUPLICATES');
      }
    }
  }
}
function previewDates(op, before) {
  return scope(op).map((namespace) => ({
    field: 'captureDate',
    representation: namespace.toUpperCase(),
    operation: op.action,
    before: representation(before, namespace),
    after: expectedDate(op, before, namespace),
    supported: true
  }));
}
module.exports = { dateWriteArgs, verifyDate, previewDates, representation };
