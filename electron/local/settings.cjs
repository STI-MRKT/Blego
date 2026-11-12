const defaults = {
  country: 'BR',
  type: 'model',
  symbols: '',
  fieldOrder: [],
  disabledFields: [],
  allowRepeats: [],
  overrides: {},
  archiveRoot: null,
  includeOriginal: false,
  newsEnabled: false,
  proxyEnabled: false,
  newsInterval: 30,
  newsSources: [],
  newsTopic: ''
};
const countries = ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'];
function validateSettings(patch) {
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    JSON.stringify(patch).length > 131072
  )
    throw Error('INVALID_SETTINGS');
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(defaults, key) || ['__proto__', 'constructor', 'prototype'].includes(key))
      throw Error('INVALID_SETTINGS');
    if (key === 'country' && !countries.includes(value)) throw Error('INVALID_COUNTRY');
    if (key === 'type' && !['model', 'tech', 'crypto'].includes(value)) throw Error('INVALID_TYPE');
    if (
      ['newsEnabled', 'proxyEnabled', 'includeOriginal'].includes(key) &&
      typeof value !== 'boolean'
    )
      throw Error('INVALID_BOOLEAN');
    if (
      ['symbols', 'newsTopic'].includes(key) &&
      (typeof value !== 'string' || value.length > 1000)
    )
      throw Error('INVALID_TEXT');
    if (
      key === 'archiveRoot' &&
      value !== null &&
      (typeof value !== 'string' || value.length > 4096)
    )
      throw Error('INVALID_PATH');
    if (key === 'newsInterval' && ![15, 30, 60, 180].includes(value))
      throw Error('INVALID_INTERVAL');
    if (
      ['fieldOrder', 'disabledFields', 'allowRepeats'].includes(key) &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some((v) => typeof v !== 'string' || v.length > 40))
    )
      throw Error('INVALID_FIELDS');
    if (
      ['disabledFields', 'allowRepeats'].includes(key) &&
      value.some((v) => ['phone', 'email', 'id', 'handle'].includes(v))
    )
      throw Error('MANDATORY_UNIQUE_CONTACTS');
    if (
      key === 'overrides' &&
      (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        /"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(value)))
    )
      throw Error('INVALID_OVERRIDES');
    if (
      key === 'newsSources' &&
      Array.isArray(value) &&
      new Set(value.map((s) => s?.id)).size !== value.length
    )
      throw Error('DUPLICATE_SOURCE_ID');
    if (
      key === 'newsSources' &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some(
          (s) =>
            !s ||
            typeof s.id !== 'string' ||
            !/^[-\w]{1,60}$/.test(s.id) ||
            typeof s.name !== 'string' ||
            s.name.length > 200 ||
            !validUrl(s.url)
        ))
    )
      throw Error('INVALID_SOURCES');
  }
  return structuredClone(patch);
}
function validUrl(raw) {
  try {
    const u = new URL(raw);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
  } catch {
    return false;
  }
}
function getSettings(store) {
  return { ...structuredClone(defaults), ...store.get('settings') };
}
function updateSettings(store, patch) {
  const clean = validateSettings(patch);
  return store.transaction(() => {
    const next = { ...getSettings(store), ...clean };
    store.set('settings', next);
    return next;
  });
}
module.exports = { defaults, countries, validateSettings, getSettings, updateSettings };
