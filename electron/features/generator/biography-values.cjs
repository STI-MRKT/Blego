const { FIELDS, validateBiographyValues, pageBio } = require('./biography.cjs');
const catalog = require('../../../resources/generator/institutions.json');
const ORGANIZATIONS = { employer: 'company', university: 'university', school: 'school' };
const CITY_FIELDS = Object.keys(ORGANIZATIONS).map((field) => field + 'City');
function validateWorkspaceBiography(values) {
  if (
    !values ||
    typeof values !== 'object' ||
    Array.isArray(values) ||
    Object.keys(values).some((key) => ![...FIELDS, ...CITY_FIELDS].includes(key))
  )
    throw Error('INVALID_BIO');
  validateBiographyValues(Object.fromEntries(FIELDS.map((key) => [key, values[key]])));
  for (const field of CITY_FIELDS)
    if (
      Object.hasOwn(values, field) &&
      (typeof values[field] !== 'string' ||
        values[field].length > 500 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[field]))
    )
      throw Error('INVALID_BIO');
}
function separateBiography(input, country, rows = catalog, previous = null) {
  const values = { ...Object.fromEntries(FIELDS.map((key) => [key, ''])), ...input },
    organizations = {};
  for (const [field, kind] of Object.entries(ORGANIZATIONS)) {
    const cityField = field + 'City',
      raw = values[field] || '';
    const candidates = rows.filter((row) => row.country === country && row.kind === kind);
    if (values[cityField] === undefined) {
      if (previous?.values[field] === raw && typeof previous.values[cityField] === 'string')
        values[cityField] = previous.values[cityField];
      else {
        const matches = candidates.filter(
          (row) => raw === row.name || raw === `${row.name} — ${row.city}`
        );
        if (matches.length === 1) {
          values[field] = matches[0].name;
          values[cityField] = matches[0].city;
        } else values[cityField] = '';
      }
    }
    const matches = candidates.filter(
      (row) => row.name === values[field] && row.city === values[cityField]
    );
    if (matches.length === 1) {
      const row = matches[0];
      organizations[field] = structuredClone(
        Object.fromEntries(
          ['id', 'name', 'city', 'country', 'region', 'kind', 'sector', 'source', 'checkedAt']
            .filter((key) => row[key] !== undefined)
            .map((key) => [key, row[key]])
        )
      );
    } else {
      const old = previous?.organizations?.[field];
      if (old && old.name === values[field] && old.city === values[cityField])
        organizations[field] = structuredClone(old);
    }
  }
  return { values, organizations };
}
function styleBiography(text, type) {
  return text
    ? pageBio(
        String(text)
          .replace(/[.。]+/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
        type
      )
    : '';
}
module.exports = {
  ORGANIZATIONS,
  CITY_FIELDS,
  validateWorkspaceBiography,
  separateBiography,
  styleBiography
};
