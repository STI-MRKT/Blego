import {
  EXTENDED_FIELDS,
  recognizeValue,
  cookieInfo,
  profileIdentity,
  personName
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
  accountId: ['accountid', 'id', 'uid', 'facebookid'],
  password: ['password', 'pass', 'passwd', 'пароль'],
  emailPassword: ['emailpassword', 'mailpassword', 'парольотпочты', 'парольпочты'],
  email: ['email', 'mail', 'почта'],
  backupEmail: [
    'backupEmail',
    'recoveryEmail',
    'reserveMail',
    'резервная почта',
    'запасная почта',
    'почта восстановления'
  ],
  birthDate: ['birthdate', 'birthday', 'dob', 'датарождения'],
  geo: ['geo', 'country', 'гео', 'страна'],
  userAgent: ['useragent', 'ua'],
  token: ['token', 'accesstoken', 'токен'],
  cookies: ['cookie', 'cookies', 'cookiejson', 'cookiesjson', 'куки']
};
const aliasMap = new Map(
  Object.entries(aliases).flatMap(([k, names]) => names.map((n) => [normalize(n), k]))
);
export const fieldForHeader = (header) => aliasMap.get(normalize(header)) || null;
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
// Learn only positions explicitly labelled by a majority (at least two) of
// equal-width records. A candidate must retain two independently typed anchors
// and agree at EVERY typed position; arbitrary adjacent strings are not a schema.
function fileLayouts(parsed) {
  const groups = new Map();
  if (!parsed.structured) return groups;
  for (const record of parsed.records) {
    const entries = record.sourceEntries || [];
    const width = entries.length;
    if (!groups.has(width))
      groups.set(width, { count: 0, positions: Array.from({ length: width }, () => new Map()) });
    const group = groups.get(width);
    group.count++;
    entries.forEach((entry, i) => {
      const r = recognizeValue(entry.value, fieldForHeader, validBirthDate, emailValid);
      if (r.explicit && !r.invalid)
        group.positions[i].set(r.key, (group.positions[i].get(r.key) || 0) + 1);
    });
  }
  for (const [width, group] of groups)
    groups.set(
      width,
      group.positions.map((counts) => {
        if (counts.size !== 1) return null;
        const [key, n] = [...counts][0];
        return n >= 2 && n > group.count / 2 ? key : null;
      })
    );
  return groups;
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
        !CLASSIFIER_FIELDS.some((f) => f.key === v && v !== 'rowNumber')
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
  const layouts = fileLayouts(parsed);
  const records = parsed.records.map((source, index) => {
    const data = Object.fromEntries(CLASSIFIER_FIELDS.map((f) => [f.key, '']));
    data.rowNumber = String(index + 1);
    const extended = Object.fromEntries(EXTENDED_FIELDS.map((k) => [k, '']));
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
      recognizeValue(
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
    const layout = layouts.get(entries.length);
    const layoutValid =
      layout &&
      recognized.every((r, i) => !r.invalid && (!r.key || !layout[i] || r.key === layout[i])) &&
      recognized.filter(
        (r, i) =>
          ['accountId', 'email', 'userAgent', 'cookies', 'profileUrl'].includes(r.key) &&
          r.key === layout[i]
      ).length >= 2;
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
      const named = parsed.headerless ? null : fieldForHeader(entry.header ?? entry.column);
      const schema = options.schema ? SCHEMAS[options.schema][position] : null;
      const mapped = Object.hasOwn(mapping, entry.column) ? mapping[entry.column] : null;
      const rowMapped = Object.hasOwn(rowMapping, entry.column) ? rowMapping[entry.column] : null;
      const found = recognized[position];
      let inferred = found.key;
      if (parsed.structured && !inferred && contextual) {
        if (/^\d+$/.test(value) && relatedIds.has(value)) inferred = 'accountId';
        else if (validBirthDate(value)) inferred = 'birthDate';
        else if (isCountry(value)) inferred = 'geo';
        else if (hasDate && hasGeo && personName(value)) inferred = 'fullName';
      }
      if (!inferred && layoutValid) inferred = layout[position];
      const key =
        rowMapped || named || schema || mapped || (parsed.structured ? inferred : guess(value));
      const priority = rowMapped
        ? 5
        : named
          ? 4
          : schema
            ? 3
            : mapped
              ? 2
              : found.explicit && parsed.structured
                ? 4
                : 1;
      const original = { ...entry, value, location: source.location };
      if (parsed.structured && !rowMapped && !named && !schema && !mapped && found.key)
        value = found.value;
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
      candidates.get(key).push({ value, priority, original });
    });
    for (const [key, values] of candidates) {
      const best = Math.max(...values.map((v) => v.priority));
      const winners = values.filter((v) => v.priority === best);
      const valid =
        winners.length === 1 &&
        !(key === 'birthDate' && winners[0].value && !validBirthDate(winners[0].value)) &&
        !(
          ['email', 'backupEmail'].includes(key) &&
          winners[0].value &&
          !emailValid(winners[0].value)
        );
      if (valid) (EXTENDED_FIELDS.includes(key) ? extended : data)[key] = winners[0].value;
      else report(winners.length > 1 ? 'AMBIGUOUS_FIELD' : 'INVALID_FIELD', key);
      for (const v of values)
        if (v.value !== '' && (!valid || v !== winners[0])) unrecognized.push(v.original);
    }
    if (parsed.structured) {
      if (identityConflict) report('IDENTITY_CONFLICT', 'accountId');
      else if (!data.accountId && relatedIds.size === 1 && !candidates.has('accountId'))
        data.accountId = [...relatedIds][0];
      if (data.cookies && cookieInfo(data.cookies)?.invalid)
        report('INVALID_COOKIE_JSON', 'cookies');
      const profile = profileIdentity(extended.profileUrl);
      if (profile?.conflict || (profile?.id && data.accountId && profile.id !== data.accountId))
        report('IDENTITY_CONFLICT', 'accountId');
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
      sourceEntries: entries
    };
  });
  return {
    records,
    diagnostics,
    rulesVersion: 'synthetic-records-1',
    columns: CLASSIFIER_FIELDS.map((f) => f.key)
  };
}
