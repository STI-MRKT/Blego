const { validateOperations } = require('../../../shared/metadata-operations.mjs');
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
  comment: ['XMP-exif:UserComment', 'EXIF:UserComment', 'File:Comment', 'PNG:Comment'],
  make: ['EXIF:Make', 'XMP-tiff:Make'],
  model: ['EXIF:Model', 'XMP-tiff:Model'],
  software: ['EXIF:Software', 'XMP-tiff:Software', 'PNG:Software'],
  captureDate: ['EXIF:DateTimeOriginal', 'EXIF:OffsetTimeOriginal', 'XMP-exif:DateTimeOriginal'],
  personalIdentifiers: [
    'EXIF:OwnerName',
    'EXIF:SerialNumber',
    'EXIF:LensSerialNumber',
    'XMP-aux:SerialNumber',
    'XMP-aux:LensSerialNumber',
    'XMP-iptcCore:CreatorContactInfo',
    'IPTC:Contact'
  ]
};
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
