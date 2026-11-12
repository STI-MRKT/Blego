const { FIELD_TAGS, validateOperations, normalizedValue, fieldKeys } = require('./policy.cjs');
const { isDeepStrictEqual } = require('node:util');
function writeArgs(operations, format) {
  const args = ['-overwrite_original', '-n', '-charset', 'IPTC=UTF8'];
  for (const op of validateOperations(operations)) {
    if (op.action === 'keep') continue;
    if (op.field === 'gps') {
      args.push(
        '-GPS:all=',
        '-XMP-exif:GPS*=',
        '-XMP-iptcExt:LocationCreatedGPS*=',
        '-XMP-iptcExt:LocationShownGPS*='
      );
      if (op.action === 'set') {
        const v = op.value;
        args.push(
          `-EXIF:GPSLatitude=${Math.abs(v.latitude)}`,
          `-EXIF:GPSLatitudeRef=${v.latitude < 0 ? 'S' : 'N'}`,
          `-EXIF:GPSLongitude=${Math.abs(v.longitude)}`,
          `-EXIF:GPSLongitudeRef=${v.longitude < 0 ? 'W' : 'E'}`,
          `-XMP-exif:GPSLatitude=${v.latitude}`,
          `-XMP-exif:GPSLongitude=${v.longitude}`
        );
        if (v.altitude != null)
          args.push(
            `-EXIF:GPSAltitude=${Math.abs(v.altitude)}`,
            `-EXIF:GPSAltitudeRef=${v.altitude < 0 ? 1 : 0}`,
            `-XMP-exif:GPSAltitude=${Math.abs(v.altitude)}`,
            `-XMP-exif:GPSAltitudeRef=${v.altitude < 0 ? 1 : 0}`
          );
      }
      continue;
    }
    const tags = FIELD_TAGS[op.field].filter(
      (tag) =>
        ((!tag.startsWith('IPTC:') && !tag.startsWith('File:')) || format === 'jpeg') &&
        (!tag.startsWith('PNG:') || format === 'png')
    );
    if (op.field === 'captureDate') {
      for (const tag of tags) args.push(`-${tag}=`);
      if (op.action === 'set') {
        const date = op.value.local.replace(/^(\d{4})-(\d{2})-(\d{2})T/, '$1:$2:$3 ');
        args.push(
          `-EXIF:DateTimeOriginal=${date}`,
          `-XMP-exif:DateTimeOriginal=${date}${op.value.offset || ''}`
        );
        if (op.value.offset) args.push(`-EXIF:OffsetTimeOriginal=${op.value.offset}`);
      }
    } else
      for (const tag of tags) {
        args.push(`-${tag}=`);
        if (op.action === 'set') {
          if (op.field === 'keywords') for (const value of op.value) args.push(`-${tag}+=${value}`);
          else args.push(`-${tag}=${op.value}`);
        }
      }
    if (format === 'jpeg' && tags.some((tag) => tag.startsWith('IPTC:')) && op.action === 'set')
      args.push('-IPTC:CodedCharacterSet=UTF8');
  }
  return args;
}
function verifyTags(operations, before, after) {
  for (const op of operations) {
    const expected =
      op.action === 'keep'
        ? normalizedValue(op.field, before)
        : op.action === 'remove'
          ? null
          : op.value;
    const actual = normalizedValue(op.field, after);
    if (op.field === 'gps' && actual && expected) {
      for (const k of ['latitude', 'longitude', 'altitude'])
        if (
          actual[k] !== expected[k] &&
          (actual[k] == null || expected[k] == null || Math.abs(actual[k] - expected[k]) > 1e-6)
        )
          throw Error('METADATA_VERIFY_GPS');
    } else if (!isDeepStrictEqual(actual, expected))
      throw Error(`METADATA_VERIFY_${op.field.toUpperCase()}`);
    if (op.field === 'gps' && op.action === 'set') {
      for (const key of fieldKeys('gps', after)) {
        if (key.startsWith('Composite:')) continue; // Derived by ExifTool, not stored metadata.
        const split = key.lastIndexOf(':'),
          group = key.split(':')[0],
          tag = key.slice(split + 1);
        const dimension = {
          GPSLatitude: 'latitude',
          GPSLongitude: 'longitude',
          GPSAltitude: 'altitude'
        }[tag];
        if (dimension) {
          let value = Number(after[key]);
          const ref = Object.entries(after).find(
            ([other]) => other.split(':')[0] === group && other.endsWith(':' + tag + 'Ref')
          )?.[1];
          if (ref === 'S' || ref === 'W' || (dimension === 'altitude' && Number(ref) === 1))
            value = -Math.abs(value);
          if (
            expected[dimension] == null ||
            !Number.isFinite(value) ||
            Math.abs(value - expected[dimension]) > 1e-6
          )
            throw Error('METADATA_VERIFY_GPS_DUPLICATES');
        } else {
          const refs = {
            GPSLatitudeRef: expected.latitude < 0 ? 'S' : 'N',
            GPSLongitudeRef: expected.longitude < 0 ? 'W' : 'E',
            GPSAltitudeRef: expected.altitude == null ? null : String(expected.altitude < 0 ? 1 : 0)
          };
          if (!Object.hasOwn(refs, tag) || String(after[key]) !== refs[tag])
            throw Error('METADATA_VERIFY_GPS_DUPLICATES');
        }
      }
    }
    if (op.action === 'remove' && fieldKeys(op.field, after).length)
      throw Error('METADATA_VERIFY_DUPLICATES');
    // Every known scalar/list copy must agree, including alternate namespace instances.
    if (op.action === 'set' && !['gps', 'captureDate'].includes(op.field))
      for (const key of fieldKeys(op.field, after)) {
        const v = after[key];
        const value =
          op.field === 'keywords'
            ? Array.isArray(v)
              ? v
              : [String(v)]
            : Array.isArray(v)
              ? v.join(', ')
              : v;
        if (!isDeepStrictEqual(value, expected)) throw Error('METADATA_VERIFY_DUPLICATES');
      }
  }
  for (const key of Object.keys(before).filter(
    (key) => /:Orientation$/.test(key) || key.startsWith('ICC_Profile:')
  ))
    if (!isDeepStrictEqual(before[key], after[key])) throw Error('METADATA_VERIFY_PROTECTED_TAG');
}
module.exports = { writeArgs, verifyTags };
