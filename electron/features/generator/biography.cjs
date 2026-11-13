const { randomInt } = require('node:crypto');
const { resolvePreset } = require('./sources.cjs');
const { loadDataset } = require('./catalog.cjs');
const { getSettings } = require('../../local/settings.cjs');
const FIELDS = [
  'residence',
  'birthplace',
  'employer',
  'position',
  'university',
  'school',
  'mainBio'
];
const COUNTRIES = {
  BR: 'Brazil',
  US: 'United States',
  FR: 'France',
  PL: 'Poland',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  GB: 'United Kingdom'
};
const EMOJI = {
  model: ['✨', '📸', '🎨', '👗'],
  tech: ['💻', '🤖', '🧠', '⚙️'],
  crypto: ['🔗', '🌐', '💡', '🔐']
};
function pageBio(text, type) {
  const pool = EMOJI[type];
  if (!pool) return text;
  return `${text} ${pool[randomInt(pool.length)]}`;
}
function bioDefaults(profile) {
  const place = [profile.fields.city, COUNTRIES[profile.country]].filter(Boolean).join(', ');
  return {
    residence: place,
    birthplace: place,
    employer: '',
    position: '',
    university: '',
    school: '',
    mainBio: '',
    ...profile.biography
  };
}
const catalog = require('../../../resources/generator/institutions.json');
const cityKey = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en');
const choose = (rows) => (rows.length ? rows[randomInt(rows.length)] : null);
const organizationLabel = (row) => (row ? `${row.name} — ${row.city}` : '');
function organizationOptions(profile, rows = catalog) {
  if (profile.namingStrategy === 'brand_name') return [];
  const city = cityKey(profile.fields.city);
  if (!city) return [];
  // No country-wide or guessed postal-code fallback. Regions must be substantiated
  // by catalog records for this exact city (including explicitly sourced aliases).
  const domestic = rows.filter(
    (row) => row.country === profile.country && row.id && row.region && row.source?.url
  );
  const isLocal = (row) =>
    [row.city, ...(row.aliases || [])].some((name) => cityKey(name) === city);
  const local = domestic.filter(isLocal);
  const regions = new Set(local.map((row) => row.region));
  const region = regions.size === 1 ? [...regions][0] : null;
  const result = [];
  for (const kind of ['company', 'university', 'school']) {
    const compatible = (row) =>
      row.kind === kind && (kind !== 'company' || row.roles?.[profile.type]?.length);
    const sameCity = local.filter(compatible);
    result.push(
      ...(sameCity.length
        ? sameCity
        : kind !== 'school' && region
          ? domestic.filter((row) => row.region === region && compatible(row))
          : [])
    );
  }
  return result;
}
function generateBiography(profile, { catalog: rows = catalog, bios = [] } = {}) {
  const personal = profile.namingStrategy !== 'brand_name';
  const place = [profile.fields.city, COUNTRIES[profile.country]].filter(Boolean).join(', ');
  const options = organizationOptions(profile, rows);
  const company = choose(options.filter((row) => row.kind === 'company'));
  return {
    residence: place,
    birthplace: personal ? place : '',
    employer: organizationLabel(company),
    position: company ? choose(company.roles[profile.type]) : '',
    university: organizationLabel(choose(options.filter((row) => row.kind === 'university'))),
    school: organizationLabel(choose(options.filter((row) => row.kind === 'school'))),
    mainBio: profile.fields.bio || choose(bios) || ''
  };
}
function suggestBiographyField(
  profile,
  field,
  { catalog: rows = catalog, bios = [], values = {} } = {}
) {
  if (!FIELDS.includes(field)) throw Error('INVALID_BIO');
  if (field === 'mainBio') return { mainBio: choose(bios) || '' };
  const options = organizationOptions(profile, rows);
  if (field === 'position') {
    const company = options.find(
      (row) => row.kind === 'company' && organizationLabel(row) === values.employer
    );
    return { position: company ? choose(company.roles[profile.type]) : '' };
  }
  const generated = generateBiography(profile, { catalog: rows, bios });
  // Replacing the employer also replaces its dependent role, never an unrelated field.
  return field === 'employer'
    ? { employer: generated.employer, position: generated.position }
    : { [field]: generated[field] };
}
function bioSuggestions(profile, { store, field, values }) {
  const p = resolvePreset(
    profile.country,
    profile.type,
    getSettings(store),
    loadDataset(store, profile.country)
  );
  return field
    ? suggestBiographyField(profile, field, { values, bios: p.bios })
    : generateBiography(profile, { bios: p.bios });
}
function saveBiography(request, { store }) {
  const { profileId, revision, values } = request || {};
  if (
    typeof profileId !== 'string' ||
    !Number.isSafeInteger(revision) ||
    !values ||
    typeof values !== 'object' ||
    Array.isArray(values) ||
    Object.keys(values).sort().join(',') !== [...FIELDS].sort().join(',') ||
    FIELDS.some(
      (k) =>
        typeof values[k] !== 'string' ||
        values[k].length > (k === 'mainBio' ? 4000 : 500) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[k])
    )
  )
    throw Error('INVALID_BIO');
  return store.transaction(() => {
    const current = store.get('lastCard');
    if (!current || current.id !== profileId || (current.biographyRevision || 0) !== revision)
      throw Error('STALE_PROFILE');
    const updated = { ...current, biography: { ...values }, biographyRevision: revision + 1 };
    const changed = store.db
      .prepare('UPDATE requests SET profile=? WHERE profile_id=?')
      .run(JSON.stringify(updated), profileId);
    if (changed.changes !== 1) throw Error('PROFILE_NOT_FOUND');
    store.set('lastCard', updated);
    return updated;
  });
}
module.exports = {
  FIELDS,
  bioDefaults,
  bioSuggestions,
  saveBiography,
  pageBio,
  organizationOptions,
  generateBiography,
  suggestBiographyField
};
