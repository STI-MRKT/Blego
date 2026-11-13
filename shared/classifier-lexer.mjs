// Deterministic, bounded TXT lexer. Offsets are UTF-16 positions in decoded text.
// JSON and browser identifiers are indivisible; source text is never reconstructed.
const maxFields = 512,
  maxRecords = 100000,
  maxDepth = 64;
const problem = (code) => Object.assign(Error(code), { code });
const strongStart = (s) =>
  /^(?:(?:id|accountId|uid)\s*[:=]\s*\d+\s*(?:::|\|)|\d{5,}\s*(?:::|\|))/i.test(s.trimStart());
const isUA = (s) =>
  /^(?:(?:user[ -]?agent|ua)\s*[:=]\s*)?(?:Mozilla|Dalvik|Opera)\//i.test(s.trimStart());
export function wantsStructuredText(text, headerFor) {
  if (
    !text.includes('|') &&
    !text.includes('::') &&
    !/^\s*(?:id|accountId|name|mail|email|cookies)\s*[:=]/i.test(text)
  )
    return false;
  const first = text
    .split(/\r?\n/, 1)[0]
    .split(/\||::|;|\t/)
    .filter(Boolean);
  const named = first.filter(headerFor).length;
  return !(named >= 2 && named >= first.length / 2);
}
function nextCookieOwner(text, start) {
  // Boundary evidence is local and bounded; never inspect arbitrary later rows.
  const tail = text.slice(start, start + 65536);
  const match = /["']name["']\s*:\s*["']c_user["']\s*,\s*["']value["']\s*:\s*"(\d+)"/.exec(tail);
  return match?.[1] || null;
}
export function structuredRecords(text) {
  const rows = [],
    diagnostics = [];
  let fields = [],
    cellStart = 0,
    recordStart = 0,
    line = 1,
    recordLine = 1;
  let depth = [],
    quoted = false,
    escaped = false,
    quoteStart = false;
  let hasCookie = false;
  const rowWarnings = [];
  function field(end) {
    if (fields.length >= maxFields) throw problem('TOO_MANY_FIELDS');
    const rawText = text.slice(cellStart, end),
      value = rawText.trim();
    fields.push({ value, rawText, range: { start: cellStart, end } });
    if (/^[\[{]/.test(value) && /"(?:name|c_user)"/.test(value)) hasCookie = true;
    cellStart = end;
  }
  function row(end, next) {
    field(end);
    if (fields.some((f) => f.value !== '')) {
      if (rows.length >= maxRecords) throw problem('TOO_MANY_RECORDS');
      const id = String(rows.length + 1);
      const sourceEntries = fields.map((f, i) => ({
        ...f,
        column: `column_${i + 1}`,
        header: null
      }));
      const location = { startLine: recordLine, endLine: line };
      rows.push({
        id,
        location,
        range: { start: recordStart, end },
        sourceRecord: text.slice(recordStart, end),
        sourceEntries,
        data: Object.fromEntries(sourceEntries.map((e) => [e.column, e.value])),
        raw: sourceEntries.map((e) => e.rawText)
      });
      for (const code of new Set(rowWarnings))
        diagnostics.push({ code, recordId: id, location, level: 'warning' });
    }
    fields = [];
    rowWarnings.length = 0;
    hasCookie = false;
    recordStart = cellStart = next;
    recordLine = line + 1;
    depth = [];
    quoted = escaped = quoteStart = false;
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      newline = c === '\n' || c === '\r';
    if (newline && depth.length) {
      const step = c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      if (strongStart(text.slice(i + step, i + step + 300))) {
        rowWarnings.push('INVALID_JSON_CELL');
        row(i, i + step);
        i += step - 1;
        line++;
        continue;
      }
    }
    if (depth.length) {
      if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++;
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '[' || c === '{') {
        depth.push(c);
        if (depth.length > maxDepth) throw problem('JSON_TOO_DEEP');
      } else if (c === ']' || c === '}') {
        if (depth.pop() !== (c === ']' ? '[' : '{')) rowWarnings.push('INVALID_JSON_CELL');
      }
      continue;
    }
    if (quoteStart) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') {
        if (text[i + 1] === '"') i++;
        else quoteStart = false;
      }
      if (c === '\n') line++;
      continue;
    }
    if (!newline && !'[\{\"|;'.includes(c) && !(c === ':' && text[i + 1] === ':')) continue;
    const current = text.slice(cellStart, i);
    if ((c === '[' || c === '{') && /^\s*(?:(?:cookies?|cookiejson)\s*[:=]\s*)?$/i.test(current)) {
      depth.push(c);
      continue;
    }
    if (c === '"' && /^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?$/u.test(current)) {
      quoteStart = true;
      continue;
    }
    const delimiter = text.startsWith('::', i)
      ? '::'
      : c === '|'
        ? '|'
        : c === ';' &&
            !isUA(current) &&
            !/^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?https?:\/\//iu.test(current)
          ? ';'
          : null;
    if (delimiter) {
      const next = i + delimiter.length;
      const upcoming = text.slice(next, next + 300).trimStart();
      const id = /^(?:(?:id|accountId|uid)\s*[:=]\s*)?(\d+)\s*(?:::|\|)/i.exec(upcoming)?.[1];
      if (hasCookie && id && nextCookieOwner(text, next) === id) {
        row(i, next);
        recordLine = line;
      } else {
        field(i);
        cellStart = next;
      }
      i = next - 1;
      continue;
    }
    if (newline) {
      const step = c === '\r' && text[i + 1] === '\n' ? 2 : 1;
      const after = text.slice(i + step, i + step + 300).trimStart();
      // An explicit continuation marker is reliable; otherwise keep lines with
      // an unfinished field separator together until a new identity appears.
      const previousSeparator = current.trim() === '' && fields.length;
      if (/^(?:::|\||;)/.test(after) || (previousSeparator && !strongStart(after))) {
        line++;
        if (step === 2) i++;
        continue;
      }
      row(i, i + step);
      line++;
      i += step - 1;
    }
  }
  if (depth.length) rowWarnings.push('INVALID_JSON_CELL');
  if (quoteStart) rowWarnings.push('UNCLOSED_QUOTE');
  if (cellStart < text.length || fields.length) row(text.length, text.length);
  const width = rows.reduce((n, r) => Math.max(n, r.sourceEntries.length), 0);
  return {
    records: rows,
    diagnostics,
    columns: Array.from({ length: width }, (_, i) => `column_${i + 1}`),
    delimiter: 'mixed',
    headerless: true,
    structured: true
  };
}
