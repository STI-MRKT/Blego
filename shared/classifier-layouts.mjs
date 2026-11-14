// Only repeated, explicitly labelled examples can teach opaque fields. Typed
// anchors select a compatible group; an ambiguous match never chooses a schema.
const anchors = new Set([
  'accountId',
  'email',
  'backupEmail',
  'userAgent',
  'cookies',
  'profileUrl'
]);
export function discoverLayouts(parsed, recognize) {
  const groups = new Map();
  if (!parsed.structured) return [];
  for (const record of parsed.records) {
    const values = (record.sourceEntries || []).map((entry) => recognize(entry.value));
    if (values.some((value) => value.invalid)) continue;
    const fields = values.map((value) => (value.explicit ? value.key : null));
    if (fields.filter((key) => anchors.has(key)).length < 2) continue;
    // Distinct roles are required; two competing labels do not teach a position.
    const named = fields.filter(Boolean);
    if (new Set(named).size !== named.length) continue;
    const signature = JSON.stringify(fields);
    if (!groups.has(signature)) {
      if (groups.size >= 64) continue;
      groups.set(signature, { fields, count: 0 });
    }
    groups.get(signature).count++;
  }
  return [...groups.values()].filter((group) => group.count >= 2);
}
export function matchingLayout(layouts, values) {
  const matches = layouts.filter(({ fields }) => {
    if (fields.length !== values.length) return false;
    let evidence = 0;
    for (const [i, value] of values.entries()) {
      if (value.invalid) return false;
      const target = fields[i];
      if (!value.value) continue;
      // Plain email syntax cannot distinguish primary from backup. Labels can.
      const compatibleEmail = value.key === 'email' && !value.explicit && target === 'backupEmail';
      if (value.key && target && value.key !== target && !compatibleEmail) return false;
      if (anchors.has(target) && (value.key === target || compatibleEmail)) evidence++;
    }
    return evidence >= 2;
  });
  return matches.length === 1 ? matches[0].fields : null;
}
