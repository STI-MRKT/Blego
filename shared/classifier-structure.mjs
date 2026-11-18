// Conservative record-local inference for unlabelled credential dumps.
// No learning from other accounts, no cross-row state, no rewriting source spans.
const uidLike = /^\d{13,20}$/;
const mailPassLike = /^(?=.{7,128}$)[^\s;|]+![0-9]{3,5}$/u;
const secretLike = /^(?=.{7,128}$)[\p{L}\p{N}@#$%&?!+=._-]+$/u;
const normalize = (entry) => String(entry.value ?? '').trim();
const typed = (r) => Boolean(r.key || r.invalid || r.invalidJSON || r.profile || r.cookie);
const passwordShape = (value) =>
  secretLike.test(value) &&
  /[\p{L}]/u.test(value) &&
  (/[\d]/u.test(value) || /[@#$%&?!+=._-]/u.test(value)) &&
  !value.includes('://');

export function inferRecordStructure(
  entries,
  recognized,
  { birthDate, personName, identityConflict = false } = {}
) {
  const roles = new Map();
  if (identityConflict || entries.length < 5 || entries.length > 64) return roles;
  const values = entries.map(normalize);
  const emails = recognized.flatMap((r, i) => (r.key === 'email' && !r.invalid ? [i] : []));
  const dates = values.flatMap((value, i) => (birthDate(value) ? [i] : []));
  const labelledIds = recognized.flatMap((r, i) =>
    r.key === 'accountId' && !r.invalid ? [i] : []
  );
  const looseIds = values.flatMap((value, i) =>
    !typed(recognized[i]) && uidLike.test(value) ? [i] : []
  );
  const ids = [...new Set([...labelledIds, ...looseIds])];
  const names = values.flatMap((value, i) =>
    !typed(recognized[i]) && personName(value) ? [i] : []
  );
  // Strong, independent anchors prevent guessing passwords from prose or
  // unrelated text. A damaged/mixed account or vague role fails closed.
  const anchored =
    emails.length >= 1 &&
    emails.length <= 2 &&
    dates.length === 1 &&
    ids.length === 1 &&
    names.length === 1;
  if (!anchored) return roles;
  if (looseIds.length === 1) roles.set(looseIds[0], 'accountId');
  roles.set(dates[0], 'birthDate');
  roles.set(names[0], 'fullName');
  // Two distinct addresses in the same anchored account are kept separately.
  // Explicit backup-email labels override this guess in classifyRecords.
  if (
    emails.length === 2 &&
    values[emails[0]].toLowerCase() !== values[emails[1]].toLowerCase() &&
    !recognized[emails[1]].explicit
  )
    roles.set(emails[1], 'backupEmail');

  const possibleMail = values.flatMap((value, i) =>
    !typed(recognized[i]) && mailPassLike.test(value) ? [i] : []
  );
  // The suffix is an account-format clue, NOT universal proof of a password.
  // Require a unique candidate following an identified email in this record.
  const mail = possibleMail.length === 1 && possibleMail[0] > emails[0] ? possibleMail[0] : -1;
  if (mail >= 0) roles.set(mail, 'emailPassword');

  const secrets = values.flatMap((value, i) =>
    !typed(recognized[i]) && !roles.has(i) && passwordShape(value) ? [i] : []
  );
  const counts = new Map();
  for (const i of secrets) counts.set(values[i], (counts.get(values[i]) || 0) + 1);
  const repeated = [...counts].filter(([, count]) => count >= 2);
  const primary =
    repeated.length === 1
      ? repeated[0][0]
      : mail >= 0 && counts.size === 1
        ? values[secrets[0]]
        : null;
  // A repeated token carries stronger within-record evidence. A single opaque
  // candidate is used only when a distinct mail password was already found.
  if (primary) for (const i of secrets) if (values[i] === primary) roles.set(i, 'password');
  return roles;
}
