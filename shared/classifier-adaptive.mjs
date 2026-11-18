// TZ19: local, explicitly confirmed structural templates.
// Persist canonical role names and non-sensitive field *types* only.
// Never persist field values, secret hashes, source text, or sample records.
const allowedRoles = new Set([
  'accountId', 'fullName', 'login', 'password', 'emailPassword', 'email',
  'backupEmail', 'birthDate', 'geo', 'cookies', 'userAgent', 'token',
  'profileUrl', 'avatarUrl', 'documentUrl', 'mailServiceUrl',
  'twoFactorUrl', 'twoFactorCode', 'limit', 'fpStatus',
  'sentCount', 'friendsInfo'
]);
const anchorRoles = new Map([
  ['accountId', 'accountId'],
  ['email', 'email'],
  ['backupEmail', 'email'],
  ['cookies', 'cookies'],
  ['userAgent', 'userAgent'],
  ['profileUrl', 'profileUrl'],
  ['birthDate', 'birthDate']
]);
const types = new Set(anchorRoles.values());
const optionalRoles = new Set(['cookies', 'userAgent', 'backupEmail']);
const strong = new Set(['accountId', 'email', 'cookies', 'userAgent', 'profileUrl']);
const MAX_LAYOUTS = 32;

export function observedType(record, validBirthDate) {
  if (!record || record.invalid || record.invalidJSON || record.profile?.conflict) return 'invalid';
  const value = String(record.value ?? '').trim();
  if (record.key === 'accountId') return 'accountId';
  if (record.key === 'email' || record.key === 'backupEmail') return 'email';
  if (record.key === 'cookies' && !record.cookie?.invalid) return 'cookies';
  if (record.key === 'userAgent') return 'userAgent';
  if (record.key === 'profileUrl') return 'profileUrl';
  if (record.key === 'birthDate' || validBirthDate?.(value)) return 'birthDate';
  if (!record.key && /^\d{13,20}$/.test(value)) return 'accountId';
  return null;
}

export function normalizeConfirmedLayout(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
      !Array.isArray(raw.roles) || !Array.isArray(raw.anchors) ||
      raw.roles.length < 2 || raw.roles.length > 64 ||
      raw.roles.length !== raw.anchors.length) return null;
  const roles = raw.roles;
  const anchors = raw.anchors;
  if (roles.some((role) => role !== null && !allowedRoles.has(role)) ||
      anchors.some((anchor, i) =>
        anchor !== null && (!types.has(anchor) || anchorRoles.get(roles[i]) !== anchor)))
    return null;
  if (roles.filter((r) => r === 'password').length > 1 ||
      roles.filter((r) => r === 'emailPassword').length > 1)
    return null;
  return { version: 1, roles: [...roles], anchors: [...anchors] };
}

export function confirmedLayout(roles, recognized, validBirthDate) {
  if (!Array.isArray(roles) || !Array.isArray(recognized) ||
      roles.length !== recognized.length) return null;
  const anchors = roles.map((role, index) => {
    const type = observedType(recognized[index], validBirthDate);
    return anchorRoles.get(role) === type ? type : null;
  });
  const layout = normalizeConfirmedLayout({ version: 1, roles, anchors });
  if (!layout || layout.anchors.filter(Boolean).length < 2 ||
      !layout.anchors.some((type) => strong.has(type))) return null;
  return layout;
}

export function sanitizeConfirmedLayouts(layouts) {
  if (!Array.isArray(layouts)) return [];
  const unique = new Map();
  for (const raw of layouts.slice(-MAX_LAYOUTS * 2)) {
    const layout = normalizeConfirmedLayout(raw);
    if (!layout) continue;
    const key = JSON.stringify([layout.roles, layout.anchors]);
    unique.set(key, layout);
  }
  return [...unique.values()].slice(-MAX_LAYOUTS);
}

export function appendConfirmedLayouts(existing, added) {
  return sanitizeConfirmedLayouts([...sanitizeConfirmedLayouts(existing), ...added]);
}

function variants(template, requestedLength) {
  const missing = template.roles.length - requestedLength;
  if (missing < 0 || missing > 2) return [];
  const optional = template.roles.flatMap((role, i) => optionalRoles.has(role) ? [i] : []);
  const omissions = [];
  if (missing === 0) omissions.push([]);
  if (missing === 1) for (const i of optional) omissions.push([i]);
  if (missing === 2) for (let i = 0; i < optional.length; i++)
    for (let j = i + 1; j < optional.length; j++)
      omissions.push([optional[i], optional[j]]);
  return omissions.map((skip) => ({
    roles: template.roles.filter((_, i) => !skip.includes(i)),
    anchors: template.anchors.filter((_, i) => !skip.includes(i))
  }));
}

export function matchConfirmedLayout(layouts, recognized, validBirthDate) {
  if (!Array.isArray(recognized) || recognized.length < 2 ||
      recognized.some((item) => item.invalid || item.invalidJSON || item.profile?.conflict))
    return null;
  const actual = recognized.map((record) => observedType(record, validBirthDate));
  const matches = new Map();
  for (const template of sanitizeConfirmedLayouts(layouts)) {
    for (const variant of variants(template, actual.length)) {
      let evidence = 0;
      let hasStrong = false;
      let valid = true;
      for (let i = 0; i < actual.length; i++) {
        const expected = variant.anchors[i];
        if (expected) {
          if (actual[i] !== expected) { valid = false; break; }
          evidence++;
          if (strong.has(expected)) hasStrong = true;
        } else if (actual[i] && actual[i] !== anchorRoles.get(variant.roles[i])) {
          // A newly typed field is a structural conflict, not an opaque secret.
          valid = false;
          break;
        } else if (actual[i] && !anchorRoles.has(variant.roles[i])) {
          valid = false;
          break;
        }
      }
      if (valid && evidence >= 2 && hasStrong)
        matches.set(JSON.stringify(variant.roles), variant.roles);
    }
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}
