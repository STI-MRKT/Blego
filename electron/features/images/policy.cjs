const { METADATA_FIELDS } = require('../../../shared/metadata-contracts.mjs');
const FIELD_TAGS = {
  title: ['XMP-dc:Title'],
  description: [
    'XMP-dc:Description',
    'EXIF:ImageDescription',
    'IPTC:Caption-Abstract',
    'PNG:Description'
  ],
  author: ['XMP-dc:Creator', 'EXIF:Artist', 'IPTC:By-line', 'PNG:Author'],
  copyright: ['XMP-dc:Rights', 'EXIF:Copyright', 'IPTC:CopyrightNotice', 'PNG:Copyright'],
  keywords: ['XMP-dc:Subject', 'IPTC:Keywords'],
  comment: ['XMP-exif:UserComment', 'EXIF:UserComment', 'JPEG:Comment', 'PNG:Comment'],
  make: ['EXIF:Make', 'XMP-tiff:Make'],
  model: ['EXIF:Model', 'XMP-tiff:Model'],
  software: ['EXIF:Software', 'XMP-tiff:Software', 'PNG:Software'],
  captureDate: ['EXIF:DateTimeOriginal', 'EXIF:OffsetTimeOriginal', 'XMP-exif:DateTimeOriginal'],
  personalIdentifiers: [
    'EXIF:CameraOwnerName',
    'EXIF:BodySerialNumber',
    'EXIF:LensSerialNumber',
    'XMP-aux:SerialNumber',
    'XMP-aux:LensSerialNumber',
    'XMP-iptcCore:CreatorContactInfo',
    'IPTC:Contact'
  ]
};
function validateOperations(operations) {
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
function fieldKeys(field, raw) {
  if (field === 'gps')
    return Object.keys(raw).filter((key) =>
      /GPS(?:Latitude|Longitude|Altitude|Position|Date|Time|Coordinates)/i.test(key)
    );
  const names = new Set((FIELD_TAGS[field] || []).map((tag) => tag.split(':').at(-1)));
  return Object.keys(raw).filter(
    (key) => names.has(key.split(':').at(-1)) && !key.startsWith('System:')
  );
}
function normalizedValue(field, raw) {
  const keys = fieldKeys(field, raw);
  if (!keys.length) return null;
  const get = (tag) => Object.entries(raw).find(([key]) => key.endsWith(':' + tag))?.[1];
  if (field === 'gps') {
    let latitude = Number(get('GPSLatitude')),
      longitude = Number(get('GPSLongitude'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (get('GPSLatitudeRef') === 'S') latitude = -Math.abs(latitude);
    if (get('GPSLongitudeRef') === 'W') longitude = -Math.abs(longitude);
    const altitude = get('GPSAltitude');
    return {
      latitude,
      longitude,
      altitude:
        altitude == null ? null : Number(altitude) * (Number(get('GPSAltitudeRef')) === 1 ? -1 : 1)
    };
  }
  if (field === 'captureDate') {
    const value = String(get('DateTimeOriginal') || '');
    return {
      local: value.slice(0, 19).replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T'),
      offset: get('OffsetTimeOriginal') || value.slice(19) || null
    };
  }
  const value = raw[keys[0]];
  if (field === 'keywords') return Array.isArray(value) ? value : [String(value)];
  return Array.isArray(value) ? value.join(', ') : value;
}
function viewTags(raw) {
  return METADATA_FIELDS.map((field) => ({
    field,
    value: normalizedValue(field, raw),
    sources: fieldKeys(field, raw),
    writable: true,
    personal: ['author', 'gps', 'captureDate', 'personalIdentifiers'].includes(field)
  }));
}
function warnings(raw) {
  const keys = Object.keys(raw);
  const result = [];
  if (keys.some((key) => /MakerNote|^(?:Canon|Nikon|Sony|Pentax|Olympus|Panasonic)/.test(key)))
    result.push('MAKER_NOTES_PRESENT');
  if (keys.some((key) => /Unknown|Exif_0x/.test(key))) result.push('UNKNOWN_METADATA_BLOCKS');
  return result;
}
module.exports = { FIELD_TAGS, validateOperations, fieldKeys, normalizedValue, viewTags, warnings };
