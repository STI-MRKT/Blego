const isAltitudeKey = (key) => !key.startsWith('Composite:') && /GPSAltitude(?:Ref)?$/.test(key);
const altitudeValues = (raw) => {
  const result = {};
  for (const [key, value] of Object.entries(raw).filter(([key]) => isAltitudeKey(key))) {
    const tag = key.split(':')[0] + ':' + key.split(':').at(-1);
    (result[tag] ||= []).push(String(value));
  }
  for (const values of Object.values(result)) values.sort();
  return result;
};
function originalAltitude(raw) {
  const entry = Object.entries(raw).find(
    ([key]) => !key.startsWith('Composite:') && key.endsWith(':GPSAltitude')
  );
  if (!entry) return null;
  const group = entry[0].split(':')[0];
  const ref = Object.entries(raw).find(
    ([key]) => key.split(':')[0] === group && key.endsWith(':GPSAltitudeRef')
  )?.[1];
  return Number(entry[1]) * (Number(ref) === 1 ? -1 : 1);
}
function expectedGPS(op, before) {
  const { altitudeMode, ...value } = op.value;
  value.altitude =
    altitudeMode === 'keep'
      ? originalAltitude(before)
      : altitudeMode === 'remove'
        ? null
        : (value.altitude ?? null);
  return value;
}
module.exports = { isAltitudeKey, altitudeValues, expectedGPS };
