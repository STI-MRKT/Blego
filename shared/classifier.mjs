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
  ['cookies', 'Куки']
].map(([key, label]) => ({ key, label }));
export const CORE_FIELDS = CLASSIFIER_FIELDS.slice(1, 8).map((f) => f.key);
export const SCHEMAS = {
  core7: CORE_FIELDS,
  full10: CLASSIFIER_FIELDS.slice(1).map((f) => f.key),
  numbered11: CLASSIFIER_FIELDS.map((f) => f.key)
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
  const m = /^(?:(\d{4})-(\d{2})-(\d{2})|(\d{2})([./])(\d{2})\5(\d{4}))$/.exec(s);
  if (!m) return false;
  const y = Number(m[1] || m[7]),
    month = Number(m[2] || m[6]),
    day = Number(m[3] || m[4]);
  if (y < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
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
    throw Error('INVALID_MAPPING');
  const diagnostics = [...parsed.diagnostics];
  const records = parsed.records.map((source, index) => {
    const data = Object.fromEntries(CLASSIFIER_FIELDS.map((f) => [f.key, '']));
    data.rowNumber = String(index + 1);
    const candidates = new Map(),
      unrecognized = [];
    const report = (code, column) =>
      diagnostics.push({
        code,
        recordId: source.id,
        location: source.location,
        column,
        level: 'warning'
      });
    const entries =
      source.sourceEntries ||
      Object.entries(source.data).map(([column, value]) => ({ column, value }));
    entries.forEach((entry, position) => {
      let value = entry.value;
      if (value == null) value = '';
      if (typeof value === 'object') value = entry.rawText ?? JSON.stringify(value);
      else if (typeof value === 'number') value = entry.rawText ?? String(value);
      else value = String(value);
      const named = parsed.headerless ? null : fieldForHeader(entry.header ?? entry.column);
      const schema = options.schema ? SCHEMAS[options.schema][position] : null;
      const mapped = Object.hasOwn(mapping, entry.column) ? mapping[entry.column] : null;
      const key = named || schema || mapped || guess(value);
      const priority = named ? 4 : schema ? 3 : mapped ? 2 : 1;
      const original = { ...entry, value, location: source.location };
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
        !(key === 'email' && winners[0].value && !emailValid(winners[0].value));
      if (valid) data[key] = winners[0].value;
      else report(winners.length > 1 ? 'AMBIGUOUS_FIELD' : 'INVALID_FIELD', key);
      for (const v of values)
        if (v.value !== '' && (!valid || v !== winners[0])) unrecognized.push(v.original);
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
    return { id: source.id, recordId: source.id, location: source.location, data, unrecognized };
  });
  return {
    records,
    diagnostics,
    rulesVersion: 'synthetic-records-1',
    columns: CLASSIFIER_FIELDS.map((f) => f.key)
  };
}
