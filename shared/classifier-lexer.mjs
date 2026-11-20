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
function confirmedHeader(text) {
  const first = text.split(/\r?\n/, 1)[0];
  for (const delimiter of [':', '/', '\\\\']) {
    const names = first.split(delimiter).map((s) => s.trim());
    if (names.length >= 2 && names.every(fieldForHeader)) return { delimiter, names };
  }
  return null;
}
function labelledStart(text) {
  const label = /^\s*([\p{L}\p{N}_ -]{1,40}?)\s*[:=]/u.exec(text);
  return label && fieldForHeader(label[1]);
}
export function wantsStructuredText(text, headerFor) {
  // A known delimited header is a table, not the first record.
  // Unknown columns can be recognized as headers without becoming data roles.
  const firstLine = text.split(/\r?\n/, 1)[0];
  const possibleHeaders = firstLine.split(/\||::|;|\t/).map((part) => part.trim());
  if (
    possibleHeaders.length >= 3 &&
    possibleHeaders.filter(headerFor).length >= 2 &&
    possibleHeaders.filter(headerFor).length >= possibleHeaders.length / 2
  )
    return false;
  if (
    confirmedHeader(text) ||
    /:[^\r\n]*@/.test(text) ||
    /(?:^|\n)\s*(?:login|twofactorcode|2fa)\s*[:=]/i.test(text)
  )
    return true;
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
export function structuredRecords(text, options = {}) {
  const header = confirmedHeader(text);
  const colonSchema = options.schema === 'credentials6';
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
  let syntaxEnd = -1,
    colonTuple = false;
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
    // Long divider lines separate account data from ancillary notes. Flush the
    // preceding record first; the delimiter itself is never a field or record.
    if ((i === 0 || text[i - 1] === '\n' || text[i - 1] === '\r') && !depth.length && !quoteStart) {
      const boundary = /^[ \t]*(?:={8,}|-{8,})[ \t]*(?:\r\n|\r|\n|$)/.exec(text.slice(i, i + 512));
      if (boundary) {
        const after = i + boundary[0].length;
        row(i, after);
        if (/\r|\n/.test(boundary[0])) line++;
        recordLine = line;
        i = after - 1;
        continue;
      }
    }
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
    if (!newline && !'[\{\"|;\t:/\\'.includes(c)) continue;
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
    if (i > syntaxEnd) {
      const start = text.lastIndexOf('\n', i - 1) + 1,
        end = text.indexOf('\n', i);
      syntaxEnd = end < 0 ? text.length : end;
      const lineText = text.slice(start, syntaxEnd);
      // The account-order family starts with an email and a *bare* secret,
      // then an ID and cookie JSON. Only this anchored prefix permits ':' as
      // a delimiter; it must not split colons inside JSON, URLs or User-Agent.
      const accountColonTuple =
        /^[^\s:;|@]+@[^\s:;|@]+\.[^\s:;|@]+:[^:;|\r\n]{4,128}:\d{13,20}:\s*(?:\[|$)/u.test(
          lineText
        );
      const continuingColonTuple =
        colonTuple && fields.length > 0 && !text.slice(cellStart, start).trim();
      colonTuple =
        continuingColonTuple ||
        accountColonTuple ||
        (!labelledStart(lineText) &&
          !/[|;\t]|::/.test(lineText) &&
          !lineText.includes('://') &&
          /:[^\r\n]*@[^\s:@]+\.[^\s:]+/.test(lineText));
    }
    const length = c === '\\' && text[i + 1] === '\\' ? 2 : 1;
    const nextLabel = labelledStart(text.slice(i + length, i + length + 100));
    const upcomingCell = text
      .slice(i + length, i + length + 200)
      .split(/[;|\r\n]/, 1)[0]
      .trim();
    const nextSpacedLabel =
      c === ';' &&
      recognizeValue(upcomingCell, fieldForHeader, validBirthDate, (v) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ).explicit;
    const composite =
      isUA(current) ||
      /^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?(?:https?:\/\/|[A-Za-z]:\\)/iu.test(current);
    const labelledIdentity =
      c === ':' && composite && nextLabel
        ? recognizeValue(current, fieldForHeader, validBirthDate, (v) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          )
        : null;
    const completedFacebookId =
      labelledIdentity?.key === 'accountId' &&
      labelledIdentity?.normalized === true &&
      !labelledIdentity.invalid;
    // A complete labelled UA can end before a known label. Keep colons
    // inside UA comments and product segments intact.
    const completedUA = isUA(current) && /(?:\)|[\w.-]+\/\d[\w.-]*)\s*$/u.test(current);
    // An unrecognised caption may follow an independently validated value,
    // e.g. "Date of Birth:1991-09-18:Инструкция:...".
    // Never infer an opaque password boundary from its punctuation alone.
    const labelledValue =
      c === ':' && !composite
        ? recognizeValue(current, fieldForHeader, validBirthDate, (v) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          )
        : null;
    const completeAtomicValue =
      labelledValue?.explicit &&
      !labelledValue.invalid &&
      ['birthDate', 'email', 'accountId'].includes(labelledValue.key);
    const unknownCaption = /^\s*([\p{L}][\p{L}\p{N}_ -]{0,39})\s*:\s*\S/u.exec(
      text.slice(i + 1, i + 150)
    );
    const splitBeforeUnknownCaption =
      completeAtomicValue && unknownCaption && !fieldForHeader(unknownCaption[1]);
    // A mailbox credential in pipe-delimited order receipts may be a single
    // email:password cell immediately before a Cookie JSON cell. Split only
    // this narrow shape, never colons in links, User-Agent or Cookie values.
    const afterMailColon = text.slice(i + 1, i + 180);
    const mailPipe = afterMailColon.indexOf('|');
    const mailSecret = mailPipe < 0 ? '' : afterMailColon.slice(0, mailPipe).trim();
    const mailboxTuple =
      c === ':' &&
      !text.startsWith('::', i) &&
      /^[^\s@;|:]+@[^\s@;|:]+\.[^\s@;|:]+$/u.test(current.trim()) &&
      /^(?=.{7,128}$)[^\s;|:]+![0-9]{3,5}$/u.test(mailSecret) &&
      mailPipe >= 0 &&
      /^\s*\[\s*\{/u.test(afterMailColon.slice(mailPipe + 1));
    const extra =
      c === ':' &&
      (!text.startsWith('::', i) || header?.delimiter === ':') &&
      (mailboxTuple ||
        (nextLabel &&
          !fieldForHeader(current.trim()) &&
          (!composite || /\s/.test(text[i - 1] || '') || completedFacebookId || completedUA)) ||
        splitBeforeUnknownCaption ||
        (!composite && (colonSchema || colonTuple || header?.delimiter === ':')))
        ? ':'
        : (c === '/' || (c === '\\' && length === 2)) &&
            ((nextLabel && /\s/.test(text[i - 1] || '') && /\s/.test(text[i + length] || '')) ||
              (header?.delimiter === text.slice(i, i + length) &&
                current.trim() &&
                /\s/.test(text[i - 1] || '') &&
                /\s/.test(text[i + length] || '')))
          ? text.slice(i, i + length)
          : null;
    const delimiter =
      extra ||
      (text.startsWith('::', i)
        ? '::'
        : c === '|' || c === '\t'
          ? c
          : c === ';' &&
              (nextLabel ||
                nextSpacedLabel ||
                (!isUA(current) &&
                  !/^\s*(?:[\p{L}\p{N}_ -]{1,40}[:=]\s*)?https?:\/\//iu.test(current)))
            ? ';'
            : null);
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
      const recognize = (value) =>
        recognizeValue(value, fieldForHeader, validBirthDate, (s) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
        );
      const nextLine = text.slice(i + step, i + step + 65536).split(/[\r\n]/, 1)[0];
      const nextField = recognize(nextLine.trim());
      const currentFields = [
        ...fields.map((field) => recognize(field.value)),
        recognize(current.trim())
      ];
      // Only an ID-anchored labelled block can continue without a separator.
      // Blank lines, a new ID, or a repeated role begin another record.
      if (
        nextField.explicit &&
        !nextField.invalid &&
        nextField.key !== 'accountId' &&
        currentFields.some(
          (field) => field.key === 'accountId' && field.explicit && !field.invalid
        ) &&
        currentFields.at(-1).explicit &&
        !currentFields.some((field) => field.key === nextField.key)
      ) {
        field(i);
        cellStart = i + step;
        line++;
        i += step - 1;
        continue;
      }
      // An explicit continuation marker is reliable; otherwise keep lines with
      // an unfinished field separator together until a new identity appears.
      const previousSeparator = current.trim() === '' && fields.length;
      if (
        /^(?:::|\||;)/.test(after) ||
        (previousSeparator && colonTuple && /^\[\s*\{/u.test(after)) ||
        (previousSeparator && !header && !options.schema && !colonTuple && !strongStart(after))
      ) {
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
      /^(?:Описание файла|Инструкция|Комментарий|Примечание|Условия|Пояснения|Заголовок|Terms|Description|Header|Read terms|Instructions?|Comments?|Notes?)(?:[:.\s]|$)/iu.test(
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
  if (header && rows.length) {
    rows.shift();
    for (const [index, record] of rows.entries()) {
      record.id = String(index + 1);
      record.sourceEntries.forEach((entry, i) => {
        entry.header = header.names[i] || null;
      });
    }
  }
  const width = rows.reduce((n, r) => Math.max(n, r.sourceEntries.length), 0);
  return {
    records: rows,
    diagnostics,
    columns: Array.from({ length: width }, (_, i) => `column_${i + 1}`),
    delimiter: 'mixed',
    headerless: !header,
    structured: true
  };
}
