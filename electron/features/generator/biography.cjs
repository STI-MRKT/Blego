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
function bioSuggestions(profile, { store }) {
  const p = resolvePreset(
    profile.country,
    profile.type,
    getSettings(store),
    loadDataset(store, profile.country)
  );
  const work = {
    model: [
      ['Independent creative studio', 'Photographer'],
      ['Independent fashion studio', 'Stylist']
    ],
    tech: [
      ['Independent software studio', 'Software Developer'],
      ['Independent data consultancy', 'Data Analyst']
    ],
    crypto: [
      ['Independent blockchain studio', 'Blockchain Developer'],
      ['Independent digital research studio', 'Research Analyst']
    ]
  }[profile.type];
  const [employer, position] = work[randomInt(work.length)];
  return {
    employer: `${employer} · ${COUNTRIES[profile.country]}`,
    position,
    mainBio: p.bios[randomInt(p.bios.length)]
  };
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
module.exports = { FIELDS, bioDefaults, bioSuggestions, saveBiography, pageBio };
