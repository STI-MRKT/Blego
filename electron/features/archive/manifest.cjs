const { createHash } = require('node:crypto');
const hash = (b) => createHash('sha256').update(b).digest('hex');
function safeName(value) {
  return (
    String(value)
      .normalize('NFC')
      .replace(/\.[^.]*$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+|[. ]+$/g, '')
      .slice(0, 90) || 'input'
  );
}
function validEntryName(name) {
  return (
    typeof name === 'string' &&
    name.length <= 240 &&
    !/^[\/\\]|^[A-Za-z]:|\\|\x00/.test(name) &&
    name.split('/').every((p) => p && p !== '.' && p !== '..')
  );
}
function validateManifest(m, entries) {
  if (
    m?.version !== 1 ||
    !/^[-a-f0-9]{36}$/.test(m.archiveId) ||
    !/^[-a-f0-9]{36}$/.test(m.operationId) ||
    !['completed', 'partial_confirmed'].includes(m.status) ||
    !Number.isFinite(Date.parse(m.processedAt)) ||
    !Number.isFinite(Date.parse(m.archivedAt)) ||
    typeof m.originalName !== 'string' ||
    !m.counts ||
    !m.entries ||
    typeof m.entries !== 'object'
  )
    throw Error('INVALID_MANIFEST');
  if (
    ['total', 'processed', 'unresolved'].some(
      (k) => !Number.isSafeInteger(m.counts[k]) || m.counts[k] < 0
    ) ||
    !Number.isSafeInteger(m.sourceSize) ||
    m.sourceSize < 0 ||
    !Number.isInteger(m.offsetMinutes) ||
    Math.abs(m.offsetMinutes) > 14 * 60 ||
    typeof m.rulesVersion !== 'string' ||
    m.rulesVersion.length > 200
  )
    throw Error('INVALID_MANIFEST');
  if (m.counts.processed + m.counts.unresolved !== m.counts.total) throw Error('INVALID_COUNTS');
  for (const required of ['result.txt', 'diagnostics.jsonl'])
    if (!entries[required] || !m.entries[required]) throw Error('MISSING_ENTRY');
  for (const [name, b] of Object.entries(entries)) {
    if (name === 'manifest.json') continue;
    const e = m.entries[name];
    if (!e || e.size !== b.length || e.sha256 !== hash(b)) throw Error('CHECKSUM_MISMATCH');
  }
  for (const name of Object.keys(m.entries)) if (!entries[name]) throw Error('MISSING_ENTRY');
  return m;
}
function fileName(m) {
  const d = new Date(Date.parse(m.processedAt) + (m.offsetMinutes || 0) * 60000);
  return `${d.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-')}__${safeName(m.originalName)}__${m.archiveId}.zip`;
}
module.exports = { hash, safeName, validEntryName, validateManifest, fileName };
