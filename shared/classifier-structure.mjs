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
  if (identityConflict || !entries.length || entries.length > 64) return roles;
  const values = entries.map(normalize);
  const emails = recognized.flatMap((r, i) => (r.key === 'email' && !r.invalid ? [i] : []));
  const dates = values.flatMap((value, i) =>
    birthDate(
      recognized[i].key === 'birthDate' && !recognized[i].invalid ? recognized[i].value : value
    )
      ? [i]
      : []
  );
  const labelledIds = recognized.flatMap((r, i) =>
    r.key === 'accountId' && !r.invalid ? [i] : []
  );
  const looseIds = values.flatMap((value, i) =>
    !typed(recognized[i]) && uidLike.test(value) ? [i] : []
  );
  const rawIds = [...new Set([...labelledIds, ...looseIds])];
  // In order receipts a single account may also carry several 13–20 digit
  // business-profile IDs. They are not additional account identities. If the
  // record contains one Cookie c_user owner and exactly one matching ID cell,
  // use that verified identity when validating credential structure.
  // Do not infer an identity when Cookie is absent, ambiguous or unmatched.
  const owners = [...new Set(recognized.flatMap((r) => r.cookie?.owners || []))];
  const ownerMatches =
    owners.length === 1
      ? rawIds.filter(
          (i) => (recognized[i].key === 'accountId' ? recognized[i].value : values[i]) === owners[0]
        )
      : [];
  const ids = ownerMatches.length === 1 ? ownerMatches : rawIds;
  const names = values.flatMap((value, i) =>
    (recognized[i].key === 'fullName' &&
      !recognized[i].invalid &&
      personName(recognized[i].value)) ||
    (!typed(recognized[i]) && personName(value) && /\p{Ll}/u.test(value))
      ? [i]
      : []
  );
  // Strong, independent anchors prevent guessing passwords from prose or
  // unrelated text. A damaged/mixed account or vague role fails closed.
  // Some verified order receipts omit the name entirely. In that case,
  // require a matching Cookie owner plus the same email appearing twice in
  // this record before inferring any unlabelled credential.
  const verifiedReceiptWithoutName =
    names.length === 0 &&
    owners.length === 1 &&
    ownerMatches.length === 1 &&
    emails.length === 2 &&
    recognized[emails[0]].value.toLowerCase() === recognized[emails[1]].value.toLowerCase();
  const anchored =
    emails.length >= 1 &&
    emails.length <= 2 &&
    dates.length === 1 &&
    ids.length === 1 &&
    (names.length === 1 || verifiedReceiptWithoutName);
  // Promote the second email only when it is tied to a coherent record.
  // Long account IDs are sufficient when DOB/name are absent; complete
  // date + ID + name anchors also qualify. Short IDs in fragmented prose
  // alone must not turn two arbitrary addresses into assigned roles.
  const hasOwnerEvidence =
    ids.length === 1 && (uidLike.test(recognized[ids[0]]?.value || values[ids[0]]) || anchored);
  const hasExplicitBackup = recognized.some(
    (r) => r.key === 'backupEmail' && r.explicit && !r.invalid
  );
  if (
    hasOwnerEvidence &&
    emails.length === 2 &&
    !hasExplicitBackup &&
    values[emails[0]].toLowerCase() !== values[emails[1]].toLowerCase()
  ) {
    const labelledPrimary = emails.filter((i) => recognized[i].explicit);
    const primary = labelledPrimary.length === 1 ? labelledPrimary[0] : emails[0];
    const secondary = emails.find((i) => i !== primary);
    roles.set(secondary, 'backupEmail');
  }
  // A verified order tuple has email:opaque-secret:FB-ID:Cookie as its
  // unique prefix. The Cookie c_user must identify the same Facebook ID.
  // No transfer between records, no filename-level or weak value-only guess.
  const cookieOwners = recognized[3]?.cookie?.owners || [];
  if (
    entries.length >= 4 &&
    entries.length <= 8 &&
    emails.length === 1 &&
    recognized[0]?.key === 'email' &&
    !typed(recognized[1]) &&
    passwordShape(values[1]) &&
    uidLike.test(values[2]) &&
    recognized[3]?.key === 'cookies' &&
    cookieOwners.length === 1 &&
    cookieOwners[0] === values[2]
  ) {
    roles.set(1, 'password');
    if (!typed(recognized[2])) roles.set(2, 'accountId');
  }
  if (!anchored || entries.length < 5) return roles;
  if (looseIds.length === 1) roles.set(looseIds[0], 'accountId');
  roles.set(dates[0], 'birthDate');
  if (names.length === 1) roles.set(names[0], 'fullName');
  const possibleMail = values.flatMap((value, i) =>
    !typed(recognized[i]) && mailPassLike.test(value) ? [i] : []
  );
  // The suffix is an account-format clue, NOT universal proof of a password.
  // Require one unique candidate and strong anchors within this same record;
  // a variable field order may put the password before its email.
  const mail = possibleMail.length === 1 ? possibleMail[0] : -1;
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
