import { discoverLayouts, matchingLayout } from './classifier-layouts.mjs';
import { inferRecordStructure } from './classifier-structure.mjs';
import {
  EXTENDED_FIELDS,
  extendedFieldForHeader,
  recognizeValue,
  recognizeLabelledValue,
  cookieInfo,
  profileIdentity,
  personName,
  safeUrl
} from './classifier-recognition.mjs';
// Production rules for the explicit synthetic-record contract in GitHub issue #2.
export const CLASSIFIER_FIELDS = [
  ['rowNumber', '№'],
  ['fullName', 'ФИО'],
  ['accountId', 'ID'],
  ['password', 'Пароль'],
  ['emailPassword', 'Пароль от почты'],
  ['email', 'Почта'],
  ['birthDate', 'Дата рождения'],
  ['geo', 'ГЕО'],
  ['userAgent', 'User-Agent'],
  ['token', 'Токен'],
  ['cookies', 'Куки'],
  ['backupEmail', 'Резервная почта']
].map(([key, label]) => ({ key, label }));
export const CORE_FIELDS = CLASSIFIER_FIELDS.slice(1, 8).map((f) => f.key);
export const SCHEMAS = {
  credentials6: ['login', 'password', 'email', 'emailPassword', 'twoFactorCode', 'accountId'],
  account5: ['login', 'password', 'accountId', 'cookies', 'userAgent'],
  mixedA: [
    'email',
    'token',
    'userAgent',
    null,
    'cookies',
    'password',
    'email',
    'password',
    'emailPassword',
    'birthDate',
    'accountId',
    'fullName'
  ],
  core7: CORE_FIELDS,
  full10: CLASSIFIER_FIELDS.slice(1, 11).map((f) => f.key),
  numbered11: CLASSIFIER_FIELDS.slice(0, 11).map((f) => f.key)
};
const normalize = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
const aliases = {
  rowNumber: ['№', 'number', 'rownumber'],
  fullName: ['fullname', 'name', 'фио', 'имя'],
  accountId: ['accountid', 'idaccount', 'id', 'uid', 'facebookid'],
  password: [
    'password',
    'pass',
    'passwd',
    'пароль',
    'fbpassword',
    'facebookpassword',
    'passwordfb',
    'passwordfacebook',
    'accountpassword',
    'парольфб',
    'парольfacebook'
  ],
  emailPassword: [
    'emailpassword',
    'mailpassword',
    'emailpass',
    'mailpass',
    'passwordemail',
    'passwordmail',
    'парольотпочты',
    'парольпочты'
  ],
  email: ['email', 'mail', 'почта'],
  backupEmail: [
    'backupEmail',
    'recoveryEmail',
    'reserveMail',
    'резервная почта',
    'запасная почта',
    'почта восстановления'
  ],
  birthDate: ['birthdate', 'dateofbirth', 'birthday', 'dob', 'датарождения'],
  geo: ['geo', 'country', 'гео', 'страна'],
  userAgent: ['useragent', 'ua'],
  token: ['token', 'accesstoken', 'токен'],
  cookies: ['cookie', 'cookies', 'cookiejson', 'cookiesjson', 'куки']
};
const aliasMap = new Map(
  Object.entries(aliases).flatMap(([k, names]) => names.map((n) => [normalize(n), k]))
);
export const fieldForHeader = (header, value) => {
  const field = aliasMap.get(normalize(header)) || extendedFieldForHeader(header);
  return field === 'twoFactorUrl' &&
    normalize(header) === '2fa' &&
    value !== undefined &&
    !safeUrl(value)
    ? 'twoFactorCode'
    : field;
};
const countryCodes = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' '
  )
);
const emailValid = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export function validBirthDate(s) {
  const m = /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})([./])(\d{1,2})\5(\d{4}))$/.exec(s);
  if (!m) return false;
  const y = Number(m[1] || m[7]),
    month = Number(m[2] || m[6]),
    day = Number(m[3] || m[4]);
  if (y < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
const countryNames = new Set(['USA', 'UK']);
for (const locale of ['en', 'ru']) {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  for (const code of countryCodes) countryNames.add(names.of(code).toLowerCase());
}
const isCountry = (value) =>
  countryCodes.has(value) || countryNames.has(value) || countryNames.has(value.toLowerCase());

// A filename is weak evidence, not a user-confirmed field. Match only complete
// country names, and reject names that mention more than one country.
const canonicalCountryWords = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}]+/gu, ' ')
    .trim();
const countryNameHints = new Map();
for (const locale of ['en', 'ru']) {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  for (const code of countryCodes) {
    const name = canonicalCountryWords(display.of(code));
    if (name.length >= 4) {
      const existing = countryNameHints.get(name);
      countryNameHints.set(name, existing && existing !== code ? null : code);
    }
  }
}
function countryFromFilename(filename) {
  const name = canonicalCountryWords(String(filename || '').replace(/\.[^.]+$/, ''));
  if (!name) return null;
  const wrapped = ` ${name} `;
  const matches = new Set();
  for (const [words, code] of countryNameHints)
    if (code && wrapped.includes(` ${words} `)) matches.add(code);
  return matches.size === 1 ? [...matches][0] : null;
}
function guess(value) {
  if (emailValid(value)) return 'email';
  if (validBirthDate(value)) return 'birthDate';
  if (countryCodes.has(value)) return 'geo';
  if (/^(Mozilla\/\d|Dalvik\/\d|Opera\/\d)/.test(value)) return 'userAgent';
  return null;
}
export function classifyRecords(parsed, options = {}) {
  if (options.schema && !Object.hasOwn(SCHEMAS, options.schema)) throw Error('INVALID_SCHEMA');
  const mapping = options.mapping || {};
  if (
    typeof mapping !== 'object' ||
    Array.isArray(mapping) ||
    Object.entries(mapping).some(
      ([k, v]) =>
        !parsed.columns.includes(k) ||
        ![...CLASSIFIER_FIELDS.slice(1).map((f) => f.key), ...EXTENDED_FIELDS].includes(v)
    )
  )
    throw Object.assign(Error('INVALID_MAPPING'), { code: 'INVALID_MAPPING' });
  const recordMapping = options.recordMapping ?? {};
  const recordIds = new Set(parsed.records.map((r) => r.id));
  if (
    !recordMapping ||
    typeof recordMapping !== 'object' ||
    Array.isArray(recordMapping) ||
    Object.keys(recordMapping).some((id) => !recordIds.has(id))
  )
    throw Object.assign(Error('INVALID_MAPPING'), { code: 'INVALID_MAPPING' });
  const diagnostics = [...parsed.diagnostics];
  const initialWarnings = new Map();
  for (const d of diagnostics) {
    if (!initialWarnings.has(d.recordId)) initialWarnings.set(d.recordId, []);
    initialWarnings.get(d.recordId).push(d);
  }
  const layouts = discoverLayouts(parsed, (value) =>
    recognizeValue(value, fieldForHeader, validBirthDate, emailValid)
  );
  const filenameCountry = countryFromFilename(parsed.originalName);
  const records = parsed.records.map((source, index) => {
    const data = Object.fromEntries(CLASSIFIER_FIELDS.map((f) => [f.key, '']));
    data.rowNumber = String(index + 1);
    const extended = Object.fromEntries(EXTENDED_FIELDS.map((k) => [k, '']));
    const fieldSources = {};
    const candidates = new Map(),
      unrecognized = [];
    const warnings = [...(initialWarnings.get(source.id) || [])];
    const report = (code, column) => {
      const warning = {
        code,
        recordId: source.id,
        location: source.location,
        column,
        level: 'warning'
      };
      diagnostics.push(warning);
      warnings.push(warning);
    };
    const entries =
      source.sourceEntries ||
      Object.entries(source.data).map(([column, value]) => ({ column, value }));
    const recognized = entries.map((entry) =>
      (entry.labelled
        ? (...args) => recognizeLabelledValue(entry.header, ...args)
        : recognizeValue)(
        typeof entry.value === 'string'
          ? entry.value
          : (entry.rawText ?? JSON.stringify(entry.value)),
        fieldForHeader,
        validBirthDate,
        emailValid
      )
    );
    const related = recognized.flatMap((r) => [
      ...(r.cookie?.owners || []),
      ...(r.profile?.id ? [r.profile.id] : []),
      ...(r.key === 'accountId' && !r.invalid && r.value ? [r.value] : [])
    ]);
    const relatedIds = new Set(related);
    const identityConflict = relatedIds.size > 1 || recognized.some((r) => r.profile?.conflict);
    const contextual = relatedIds.size > 0;
    const hasDate = recognized.some((r) => validBirthDate(r.value || ''));
    const hasGeo = recognized.some((r) => r.key === 'geo' || isCountry(r.value || ''));
    const layout = matchingLayout(layouts, recognized);
    const layoutValid = Boolean(layout);
    const structure = parsed.structured && !options.schema
      ? inferRecordStructure(entries, recognized, {
          birthDate: validBirthDate,
          personName,
          identityConflict
        })
      : new Map();
    const rowMapping = options.recordMapping?.[source.id] || {};
    if (
      typeof rowMapping !== 'object' ||
      Array.isArray(rowMapping) ||
      Object.entries(rowMapping).some(
        ([column, key]) =>
          !entries.some((e) => e.column === column) ||
          ![...CLASSIFIER_FIELDS.slice(1).map((f) => f.key), ...EXTENDED_FIELDS].includes(key)
      )
    )
      throw Object.assign(Error('INVALID_MAPPING'), { code: 'INVALID_MAPPING' });
    entries.forEach((entry, position) => {
      let value = entry.value;
      if (value == null) value = '';
      if (typeof value === 'object') value = entry.rawText ?? JSON.stringify(value);
      else if (typeof value === 'number') value = entry.rawText ?? String(value);
      else value = String(value);
      const named = parsed.headerless ? null : fieldForHeader(entry.header ?? entry.column, value);
      const schema =
        options.schema &&
        (!['credentials6', 'account5', 'mixedA'].includes(options.schema) ||
          entries.length === SCHEMAS[options.schema].length)
          ? SCHEMAS[options.schema][position]
          : null;
      const mapped = Object.hasOwn(mapping, entry.column) ? mapping[entry.column] : null;
      const rowMapped = Object.hasOwn(rowMapping, entry.column) ? rowMapping[entry.column] : null;
      const found = recognized[position];
      let inferred = structure.get(position) || found.key;
      if (parsed.structured && !entry.labelled && !inferred && contextual) {
        if (/^\d+$/.test(value) && relatedIds.has(value)) inferred = 'accountId';
        else if (validBirthDate(value)) inferred = 'birthDate';
        else if (isCountry(value)) inferred = 'geo';
        else if (hasDate && hasGeo && personName(value)) inferred = 'fullName';
      }
      const learned = layoutValid && layout[position];
      if (
        learned &&
        (!inferred || (!found.explicit && inferred === 'email' && learned === 'backupEmail'))
      )
        inferred = learned;
      const key =
        rowMapped || mapped || named || schema || (parsed.structured ? inferred : guess(value));
      const priority = rowMapped
        ? 6
        : mapped
          ? 5
          : named
            ? 4
            : schema
              ? 3
              : found.explicit && parsed.structured
                ? 4
                : structure.has(position) ? 2 : 1;
      const original = { ...entry, value, location: source.location };
      if (parsed.structured && (!named || !found.explicit || found.normalized)) value = found.value;
      if (parsed.structured && found.invalidJSON) report('INVALID_COOKIE_JSON', entry.column);
      if (parsed.structured && found.invalid && !rowMapped && !mapped) {
        report('INVALID_FIELD', entry.column);
        unrecognized.push(original);
        return;
      }
      if (key === 'rowNumber') return;
      if (!key) {
        if (value !== '') unrecognized.push(original);
        return;
      }
      if (!candidates.has(key)) candidates.set(key, []);
      candidates.get(key).push({
        value,
        priority,
        original,
        method:
          rowMapped || mapped
            ? 'manual'
            : named || found.explicit
              ? 'label'
              : schema
                ? 'schema'
                : learned === key
                  ? 'repeated-layout'
                  : structure.get(position) === key
                    ? 'record-local-layout'
                    : 'syntax-context'
      });
    });
    // Heuristic assignments remain reviewable and never override manual/labelled
    // fields. Warn once per role, without exposing the credential itself.
    for (const key of ['password', 'emailPassword', 'backupEmail']) {
      if ([...candidates.get(key) || []].some((item) => item.method === 'record-local-layout'))
        report(key === 'backupEmail' ? 'SECOND_EMAIL_SAME_RECORD' : 'CREDENTIAL_LAYOUT_INFERRED', key);
    }
    for (const [key, values] of candidates) {
      const best = Math.max(...values.map((v) => v.priority));
      const bestValues = values.filter((v) => v.priority === best);
      const winners = [...new Map(bestValues.map((v) => [v.value, v])).values()];
      const valid =
        winners.length === 1 &&
        !(key === 'birthDate' && winners[0].value && !validBirthDate(winners[0].value)) &&
        !(
          ['email', 'backupEmail'].includes(key) &&
          winners[0].value &&
          !emailValid(winners[0].value)
        );
      if (valid) {
        (EXTENDED_FIELDS.includes(key) ? extended : data)[key] = winners[0].value;
        fieldSources[key] = [
          {
            column: winners[0].original.column,
            range: winners[0].original.range,
            method: winners[0].method
          }
        ];
      } else report(winners.length > 1 ? 'AMBIGUOUS_FIELD' : 'INVALID_FIELD', key);
      for (const v of values)
        if (v.value !== '' && (!valid || v.value !== winners[0].value))
          unrecognized.push(v.original);
    }
    if (parsed.structured) {
      if (identityConflict) report('IDENTITY_CONFLICT', 'accountId');
      else if (!data.accountId && relatedIds.size === 1 && !candidates.has('accountId')) {
        data.accountId = [...relatedIds][0];
        fieldSources.accountId = entries
          .filter((_, i) => recognized[i].cookie?.owners?.length || recognized[i].profile?.id)
          .map((entry) => ({
            column: entry.column,
            range: entry.range,
            method: 'linked-identity'
          }));
      }
      if (data.cookies && cookieInfo(data.cookies)?.invalid)
        report('INVALID_COOKIE_JSON', 'cookies');
      const profile = profileIdentity(extended.profileUrl);
      if (profile?.conflict || (profile?.id && data.accountId && profile.id !== data.accountId))
        report('IDENTITY_CONFLICT', 'accountId');
    }
    if (!data.geo && !candidates.has('geo') && filenameCountry) {
      data.geo = filenameCountry;
      fieldSources.geo = [{ column: '__filename__', range: null, method: 'filename-hint' }];
      report('GEO_FROM_FILENAME', 'geo');
    }
    if (unrecognized.length) report('UNRECOGNIZED_VALUES');
    if (data.cookies && data.accountId) {
      try {
        const cookie = JSON.parse(data.cookies);
        const owners = Array.isArray(cookie)
          ? cookie.filter((c) => c?.name === 'c_user').map((c) => String(c.value))
          : cookie?.c_user == null
            ? []
            : [String(cookie.c_user)];
        if (owners.some((id) => id !== data.accountId)) report('COOKIE_ID_CONFLICT', 'cookies');
      } catch {
        /* Opaque cookie text remains exact and is never used for authentication. */
      }
    }
    const any = [
      ...Object.entries(data)
        .filter(([k]) => k !== 'rowNumber')
        .map(([, v]) => v),
      ...Object.values(extended)
    ].some(Boolean);
    return {
      id: source.id,
      recordId: source.id,
      location: source.location,
      data,
      unrecognized,
      extended,
      extraFields: unrecognized,
      warnings,
      confidence: !any ? 'unknown' : warnings.length ? 'review' : 'recognized',
      sourceRecord:
        source.sourceRecord ??
        (typeof source.raw === 'string' ? source.raw : JSON.stringify(source.raw)),
      range: source.range,
      sourceEntries: entries,
      fieldSources
    };
  });
  return {
    records,
    diagnostics,
    rulesVersion: 'synthetic-records-1',
    layouts: layouts.map(({ fields, count }) => ({ fields, examples: count })),
    columns: CLASSIFIER_FIELDS.map((f) => f.key)
  };
}
