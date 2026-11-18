// Strict fallback for value-only TXT in which each account occupies several
// physical lines and ends with a Facebook ID. No values or patterns are stored.
// Source spans remain byte-for-byte equivalent within the decoded text.
const email = /^[^\s@;|:]+@[^\s@;|:]+\.[^\s@;|:]+$/u;
const identifier = /^\d{13,20}$/u;
const recovery = /^(?:[A-Z0-9]{4}\s+){3}[A-Z0-9]{4}$/u;

export function verticalAccountRecords(text) {
  // This unusual fallback must not scan or allocate per-line objects for
  // large already supported ordinary TXT/CSV imports.
  if (text.length > 8 * 1024 * 1024) return null;
  const idLines = text.match(/^[ \t]*\d{13,20}[ \t]*$/gm);
  if (!idLines || idLines.length < 2 || idLines.length > 10000) return null;
  if (!recovery.test('AAAA BBBB CCCC DDDD') ||
      !/(?:[A-Z0-9]{4}[ \t]+){3}[A-Z0-9]{4};?[ \t]*$/m.test(text))
    return null;
  const entries = [];
  let start = 0;
  let lineNumber = 1;
  for (let i = 0; i <= text.length; i++) {
    if (i !== text.length && text[i] !== '\r' && text[i] !== '\n') continue;
    const raw = text.slice(start, i);
    const value = raw.trim().replace(/^\uFEFF/u, '').replace(/;$/u, '').trim();
    if (value)
      entries.push({
        value,
        rawText: raw,
        range: { start: start + Math.max(0, raw.search(/\S/u)), end: i },
        line: lineNumber
      });
    if (text[i] === '\r' && text[i + 1] === '\n') i++;
    start = i + 1;
    lineNumber++;
  }
  const groups = [];
  let current = [];
  for (const entry of entries) {
    current.push(entry);
    if (identifier.test(entry.value)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length || groups.length < 2 || groups.length > 10000) return null;
  if (
    groups.some(
      (group) =>
        group.length < 5 ||
        group.length > 9 ||
        !email.test(group[0].value) ||
        group.filter((entry) => email.test(entry.value)).length < 2 ||
        group.filter((entry) => email.test(entry.value)).length > 3 ||
        !recovery.test(group.at(-2).value) ||
        !identifier.test(group.at(-1).value)
    )
  )
    return null;

  const records = groups.map((group, index) => {
    const first = group[0];
    const last = group.at(-1);
    const sourceEntries = group.map(({ value, rawText, range }, column) => ({
      column: 'column_' + (column + 1),
      header: null,
      value,
      rawText,
      range
    }));
    return {
      id: String(index + 1),
      location: { startLine: first.line, endLine: last.line },
      range: { start: first.range.start, end: last.range.end },
      sourceRecord: text.slice(first.range.start, last.range.end),
      sourceEntries,
      data: Object.fromEntries(sourceEntries.map((entry) => [entry.column, entry.value])),
      raw: sourceEntries.map((entry) => entry.rawText)
    };
  });
  const width = Math.max(...groups.map((group) => group.length));
  return {
    records,
    columns: Array.from({ length: width }, (_, index) => 'column_' + (index + 1)),
    delimiter: 'vertical-lines',
    headerless: true,
    structured: true,
    diagnostics: []
  };
}
