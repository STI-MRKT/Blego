export const EXTENDED_FIELDS = [
  'profileUrl',
  'mailServiceUrl',
  'twoFactorUrl',
  'avatarUrl',
  'documentUrl',
  'limit',
  'fpStatus',
  'sentCount',
  'friendsInfo'
];
const extendedAliases = new Map(
  Object.entries({
    profileUrl: ['profileurl', 'facebookurl', 'profile'],
    mailServiceUrl: ['mailservice', 'mailserviceurl'],
    twoFactorUrl: ['2fa', 'twofactorurl'],
    avatarUrl: ['ava', 'avatar', 'avatarurl'],
    documentUrl: ['doc', 'document', 'documenturl'],
    limit: ['limit'],
    fpStatus: ['fp', 'fpstatus'],
    sentCount: ['sent', 'sentcount'],
    friendsInfo: ['friend', 'friends', 'friendsinfo']
  }).flatMap(([key, names]) => names.map((name) => [name, key]))
);
const normalize = (s) => s.toLowerCase().replace(/[\s_-]+/g, '');
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}
export function profileIdentity(value) {
  const u = safeUrl(value);
  if (
    !u ||
    !['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com'].includes(
      u.hostname
    )
  )
    return null;
  let id = null;
  if (u.pathname === '/profile.php') {
    const ids = [...new Set(u.searchParams.getAll('id'))];
    if (ids.length > 1) return { url: value, id: null, conflict: true };
    id = ids[0];
  } else if (/^\/\d+\/?$/.test(u.pathname)) id = u.pathname.replaceAll('/', '');
  else if (/^\/people\/[^/]+\/\d+\/?$/.test(u.pathname))
    id = u.pathname.split('/').filter(Boolean).at(-1);
  if (!id && !/^\/[\w.-]+\/?$/.test(u.pathname)) return null;
  if (
    /^\/(?:login|checkpoint|recover|help|settings|privacy|groups|watch|marketplace|reel)(?:\/|\.|$)/i.test(
      u.pathname
    )
  )
    return null;
  return { url: value, id: id && /^\d+$/.test(id) ? id : null };
}
export function cookieInfo(value) {
  if (!/^[\[{]/.test(value)) return null;
  let data;
  try {
    data = JSON.parse(value, (_key, v, context) =>
      typeof v === 'number' && !Number.isSafeInteger(v) ? (context?.source ?? null) : v
    );
  } catch {
    return { invalid: true, owners: [] };
  }
  if (
    Array.isArray(data) &&
    data.length &&
    data.every(
      (c) =>
        c && typeof c.name === 'string' && ['string', 'number', 'boolean'].includes(typeof c.value)
    )
  ) {
    return {
      owners: data
        .filter((c) => c.name === 'c_user' && /^\d+$/.test(String(c.value)))
        .map((c) => String(c.value))
    };
  }
  if (data && !Array.isArray(data) && typeof data === 'object' && Object.hasOwn(data, 'c_user'))
    return { owners: /^\d+$/.test(String(data.c_user)) ? [String(data.c_user)] : [] };
  return null;
}
export function recognizeValue(raw, headerFor, validDate, emailValid) {
  // Strip only syntax around labels; quoted payloads use JSON string decoding.
  let value = raw,
    key = null,
    explicit = false;
  const m = [
    /^\s*([\p{L}\p{N}_ -]{1,40}?)\s*[:=]\s*([\s\S]*)$/u.exec(raw),
    /^\s*([\p{L}\p{N}_-]{1,40})\s+([\s\S]*)$/u.exec(raw)
  ].find((match) => match && (headerFor(match[1]) || extendedAliases.has(normalize(match[1]))));
  if (m) {
    key = headerFor(m[1]) || extendedAliases.get(normalize(m[1]));
    if (key) {
      explicit = true;
      value = m[2];
    }
  }
  if (explicit && /^"[\s\S]*"$/.test(value)) {
    try {
      const v = JSON.parse(value);
      if (typeof v === 'string') value = v;
    } catch {
      /* keep exact malformed payload for review */
    }
  }
  if (key) {
    const invalid =
      (key === 'email' && value && !emailValid(value)) ||
      (key === 'birthDate' && value && !validDate(value)) ||
      (key === 'accountId' && value && !/^\d+$/.test(value)) ||
      (key.endsWith('Url') && value && !safeUrl(value)) ||
      (['limit', 'sentCount'].includes(key) && value && !/^\d+$/.test(value));
    return {
      key,
      value,
      explicit,
      invalid: !!invalid,
      cookie: key === 'cookies' ? cookieInfo(value) : null
    };
  }
  const profile = profileIdentity(value);
  if (profile) return { key: 'profileUrl', value, profile };
  const cookie = cookieInfo(value);
  if (cookie && !cookie.invalid) return { key: 'cookies', value, cookie };
  if (cookie?.invalid) return { invalidJSON: true, value };
  if (emailValid(value)) return { key: 'email', value };
  if (/^(Mozilla\/\d|Dalvik\/\d|Opera\/\d)/.test(value)) return { key: 'userAgent', value };
  return { value };
}
export function personName(value) {
  return /^[\p{Lu}][\p{L}\p{M}'’-]+(?:\s+[\p{Lu}][\p{L}\p{M}'’-]+){1,3}$/u.test(value);
}
