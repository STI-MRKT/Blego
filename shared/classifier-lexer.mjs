import { cookieInfo, recognizeValue, personName } from './classifier-recognition.mjs';
import { fieldForHeader, validBirthDate } from './classifier.mjs';
// Deterministic, bounded TXT lexer. Offsets are UTF-16 positions in decoded text.
// JSON and browser identifiers are indivisible; source text is never reconstructed.
const maxFields = 512,
  maxRecords = 100000,
  maxDepth = 64;
const problem = (code) => Object.assign(Error(code), { code });
const strongStart = (s) =>
  /^(?:(?:id|accountId|uid)\s*[:=]\s*\d+\s*(?:::|\||;|\t)|\d{5,}\s*(?:::|\||;|\t))/i.test(
    s.trimStart()
  );
const isUA = (s) =>
  /^(?:(?:user[ -]?agent|ua)\s*[:=]\s*)?(?:Mozilla|Dalvik|Opera)\//i.test(s.trimStart());
export function wantsStructuredText(text, headerFor) {
  if (
    !text.includes('|') &&
    !text.includes('::') &&
    !text.includes('\t') &&
    !text.includes(';') &&
    !/^\s*(?:id|accountId|name|mail|email|cookies)\s*[:=]/im.test(text)
  )
    return false;
  const first = text
    .split(/\r?\n/, 1)[0]
    .split(/\||::|;|\t/)
    .filter(Boolean);
  const named = first.filter(headerFor).length;
  return !(named >= 2 && named >= first.length / 2);
}
const cookiePrefix = /^(?:cookies?(?:[\s_-]*json)?|куки)\s*[:=]\s*/iu;
function completedCookie(value) {
  const info = cookieInfo(value.trim().replace(cookiePrefix, ''));
  return info && !info.invalid ? info : null;
}
function nextCookieOwner(text, start) {
  // Parse only complete, bounded JSON candidates. Key order and object/array forms are equivalent.
  const tail = text.slice(start, start + 65536);
  const candidate = /(?:^|::|\||;)\s*(?:(?:cookies?(?:[\s_-]*json)?|куки)\s*[:=]\s*)?([\[{])/giu;
  let match;
  while ((match = candidate.exec(tail))) {
    const begin = candidate.lastIndex - 1;
    const stack = [];
    let quote = false,
      escape = false;
    for (let i = begin; i < tail.length; i++) {
      const char = tail[i];
      if (quote) {
        if (escape) escape = false;
        else if (char === '\\') escape = true;
        else if (char === '"') quote = false;
      } else if (char === '"') quote = true;
      else if (char === '[' || char === '{') {
        stack.push(char);
        if (stack.length > maxDepth) return null;
      } else if (char === ']' || char === '}') {
        if (stack.pop() !== (char === ']' ? '[' : '{')) return null;
        if (!stack.length) {
          const info = completedCookie(tail.slice(begin, i + 1));
          if (info) return info.owners.length === 1 ? info.owners[0] : null;
          candidate.lastIndex = i + 1;
          break;
        }
      }
      if (i === tail.length - 1) return null;
    }
  }
  return null;
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
    if (!hasCookie && completedCookie(value)) hasCookie = true;
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
    if (!newline && !'[\{\"|;\t'.includes(c) && !(c === ':' && text[i + 1] === ':')) continue;
    const current = text.slice(cellStart, i);
    if (
      (c === '[' || c === '{') &&
      /^\s*(?:(?:cookies?(?:[\s_-]*json)?|куки)\s*[:=]\s*)?$/i.test(current)
    ) {
      depth.push(c);
      continue;
    }
    if (c === '"' && /^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?$/u.test(current)) {
      quoteStart = true;
      continue;
    }
    const delimiter = text.startsWith('::', i)
      ? '::'
      : c === '|' || c === '\t'
        ? c
        : c === ';' &&
            !isUA(current) &&
            !/^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?https?:\/\//iu.test(current)
          ? ';'
          : null;
    if (delimiter) {
      const next = i + delimiter.length;
      const upcoming = text.slice(next, next + 300).trimStart();
      const id = /^(?:(?:id|accountId|uid)\s*[:=]\s*)?(\d+)\s*(?:::|\||;|\t)/i.exec(upcoming)?.[1];
      if (id && (hasCookie || completedCookie(current)) && nextCookieOwner(text, next) === id) {
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
  // Only confidently identified prose is omitted. Weak and unrecognized rows
  // remain available for manual review; absence of a typed anchor is not junk.
  const evidence = (r) =>
    r.sourceEntries.length >= 2 ||
    r.sourceEntries.some(
      ({ value }) =>
        recognizeValue(value, fieldForHeader, validBirthDate, (s) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
        ).key ||
        /^\d+$/.test(value) ||
        validBirthDate(value) ||
        personName(value)
    );
  const prose = (r) =>
    !evidence(r) &&
    (/^(?:#|\/\/|--)(?:\s|$)/u.test(r.sourceEntries[0].value) ||
      /^(?:Описание файла|Инструкция|Комментарий|Примечание|Read terms|Instructions?|Comments?|Notes?)(?:[:.\s]|$)/iu.test(
        r.sourceEntries[0].value
      ));
  const useful = rows.some(evidence) ? rows.filter((r) => !prose(r)) : rows;
  if (useful.length && useful.length !== rows.length) {
    const ids = new Set(useful.map((r) => r.id));
    const retained = diagnostics.filter((d) => ids.has(d.recordId));
    const remap = new Map(useful.map((r, i) => [r.id, String(i + 1)]));
    for (const r of useful) r.id = remap.get(r.id);
    for (const d of retained) d.recordId = remap.get(d.recordId);
    rows.splice(0, rows.length, ...useful);
    diagnostics.splice(0, diagnostics.length, ...retained);
  }
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
