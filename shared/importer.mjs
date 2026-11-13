import { MAX_INPUT_BYTES, failure } from './contracts.mjs';
import { fieldForHeader } from './classifier.mjs';
import { wantsStructuredText, structuredRecords } from './classifier-lexer.mjs';
function diagnostic(code, location = {}, recordId = null, level = 'warning') {
  return { code, location, recordId, level };
}
function delimited(text, delimiter, structured = false) {
  const rows = [];
  let cells = [],
    value = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1,
    rowStart = 0,
    depth = [],
    jsonString = false,
    escaped = false;
  function cell() {
    cells.push(value);
    value = '';
    closed = false;
  }
  function row(end) {
    cell();
    rows.push({
      cells,
      location: { startLine: start, endLine: line },
      range: { start: rowStart, end }
    });
    cells = [];
  }
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (structured && depth.length) {
      value += c;
      if (c === '\n') line++;
      if (jsonString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') jsonString = false;
      } else if (c === '"') jsonString = true;
      else if (c === '{' || c === '[') depth.push(c);
      else if (c === '}' || c === ']') {
        if (depth.pop() !== (c === '}' ? '{' : '['))
          throw failure('INVALID_JSON_CELL', 'parse', { line });
      }
      continue;
    }
    if (structured && !quoted && !value.trim() && (c === '{' || c === '[')) {
      depth.push(c);
      value += c;
      continue;
    }
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        value += c;
        if (c === '\n') line++;
      }
      continue;
    }
    if (c === '"') {
      if (value || closed) throw failure('INVALID_QUOTE', 'parse', { line });
      quoted = true;
      continue;
    }
    if (c === delimiter) {
      cell();
      continue;
    }
    if (c === '\n' || c === '\r') {
      row(i);
      if (c === '\r' && text[i + 1] === '\n') i++;
      rowStart = i + 1;
      line++;
      start = line;
      continue;
    }
    if (closed) throw failure('TEXT_AFTER_QUOTE', 'parse', { line });
    value += c;
  }
  if (depth.length) throw failure('INVALID_JSON_CELL', 'parse', { line });
  if (quoted) throw failure('UNCLOSED_QUOTE', 'parse', { line });
  if (value || cells.length || closed) row(text.length);
  return rows;
}
function delimiterOf(text, structured = false) {
  let q = false,
    escaped = false,
    depth = 0;
  const counts = new Map([',', ';', '\t', ...(structured ? ['|'] : [])].map((d) => [d, 0]));
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (escaped) escaped = false;
      else if (c === '\\' && depth) escaped = true;
      else if (c === '"') {
        if (!depth && text[i + 1] === '"') i++;
        else q = false;
      }
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (structured && (c === '[' || c === '{')) {
      depth++;
      continue;
    }
    if (structured && (c === ']' || c === '}')) {
      depth--;
      continue;
    }
    if (depth) continue;
    if (/[\r\n]/.test(c)) break;
    if (counts.has(c)) counts.set(c, counts.get(c) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] && ranked[0][1] === ranked[1][1]) throw failure('AMBIGUOUS_DELIMITER', 'parse');
  return ranked[0][1] ? ranked[0][0] : structured ? null : ',';
}
// JSON has already been validated. Walk source tokens to retain top-level member
// spans, including repeated keys and exact nested cookie representations.
function jsonEntries(text) {
  let i = 0;
  const ws = () => {
    while (/\s/.test(text[i] || '') && i < text.length) i++;
  };
  function string() {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') i += 2;
      else if (text[i++] === '"') break;
    }
    return JSON.parse(text.slice(start, i));
  }
  function skip() {
    ws();
    if (text[i] === '"') {
      string();
      return;
    }
    if ('[{'.includes(text[i])) {
      const close = text[i++] === '[' ? ']' : '}';
      while (text[i] !== close) {
        ws();
        if (text[i] === close) break;
        if (text[i] === ',' || text[i] === ':') i++;
        else skip();
      }
      i++;
      return;
    }
    while (i < text.length && !/[\s,\]}:]/.test(text[i])) i++;
  }
  const rows = [];
  ws();
  i++;
  ws();
  while (i < text.length && text[i] !== ']') {
    const entries = [];
    ws();
    const recordStart = i;
    if (text[i] === '{') {
      i++;
      ws();
      while (text[i] !== '}') {
        const column = string();
        ws();
        i++;
        ws();
        const start = i;
        skip();
        const end = i;
        const rawText = text.slice(start, end),
          value = JSON.parse(rawText);
        entries.push({
          column,
          value: typeof value === 'number' ? rawText : value,
          rawText,
          range: { start, end }
        });
        ws();
        if (text[i] === ',') {
          i++;
          ws();
        }
      }
      i++;
    } else skip();
    rows.push({ entries, range: { start: recordStart, end: i } });
    ws();
    if (text[i] === ',') {
      i++;
      ws();
    }
  }
  return rows;
}
export function parseText(text, format, options = {}) {
  text = text.replace(/^\uFEFF/, '');
  const diagnostics = [];
  let records = [],
    columns = [],
    delimiter = null,
    headerless = false;
  let structured = false;
  if (
    format === 'txt' &&
    options.classification &&
    !options.schema &&
    options.headers !== true &&
    wantsStructuredText(text, fieldForHeader)
  ) {
    const result = structuredRecords(text);
    ({ records, columns, delimiter, headerless, structured } = result);
    diagnostics.push(...result.diagnostics);
  } else if (format === 'json') {
    let a;
    try {
      a = JSON.parse(text, (_key, value, context) => {
        if (
          typeof value === 'number' &&
          (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
        ) {
          if (!context || typeof context.source !== 'string')
            throw failure('JSON_NUMBER_PRECISION', 'parse');
          return context.source;
        }
        return value;
      });
    } catch {
      throw failure('INVALID_JSON', 'parse');
    }
    if (!Array.isArray(a)) throw failure('JSON_ARRAY_REQUIRED', 'parse');
    records = a.map((data, i) => {
      const id = String(i + 1),
        location = { objectIndex: i };
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        diagnostics.push(diagnostic('NON_OBJECT', location, id));
        return { id, location, data: { value: data }, raw: data };
      }
      for (const k of Object.keys(data)) if (!columns.includes(k)) columns.push(k);
      return { id, location, data, raw: data };
    });
    if (records.some((r) => r.data !== r.raw) && !columns.includes('value')) columns.push('value');
    if (options.classification) {
      const entries = jsonEntries(text);
      records.forEach((r, i) => {
        if (entries[i].entries.length) r.sourceEntries = entries[i].entries;
        r.range = entries[i].range;
        r.sourceRecord = text.slice(r.range.start, r.range.end);
      });
    }
  } else if (format === 'txt' && !(options.classification && delimiterOf(text, true))) {
    columns = ['text'];
    records = (text === '' ? [] : text.split(/\r\n|\n|\r/)).map((value, i) => ({
      id: String(i + 1),
      location: { startLine: i + 1, endLine: i + 1 },
      data: { text: value },
      raw: value
    }));
  } else if (['csv', 'tsv', ...(options.classification ? ['txt'] : [])].includes(format)) {
    delimiter = format === 'tsv' ? '\t' : delimiterOf(text, options.classification) || ',';
    const rows = delimited(text, delimiter, options.classification);
    const firstCells = (rows[0]?.cells || []).filter((v) => v !== '');
    const namedCount = firstCells.filter(fieldForHeader).length;
    const confidentHeaders =
      firstCells.length === 1
        ? namedCount === 1
        : namedCount >= 2 && namedCount >= firstCells.length / 2;
    headerless =
      options.classification &&
      (options.headers === false || (options.headers !== true && !confidentHeaders));
    const headers = headerless
      ? Array.from({ length: rows[0]?.cells.length || 0 }, (_, i) => `column_${i + 1}`)
      : rows.shift()?.cells || [];
    const seen = new Set();
    columns = headers.map((h, i) => {
      let key = h || `column_${i + 1}`;
      const base = key;
      let n = 1;
      while (seen.has(key)) key = `${base}[${++n}]`;
      if (key !== base)
        diagnostics.push(diagnostic('DUPLICATE_HEADER', { startLine: 1, endLine: 1 }));
      seen.add(key);
      return key;
    });
    records = rows.map(({ cells, location, range }, i) => {
      const id = String(i + 1),
        data = Object.create(null);
      for (let j = 0; j < Math.max(cells.length, headers.length); j++) {
        if (!columns[j]) {
          let key = `extra_${j + 1}`;
          while (seen.has(key)) key += '_';
          columns[j] = key;
          seen.add(key);
        }
        data[columns[j]] = cells[j] ?? null;
      }
      if (cells.length > headers.length) diagnostics.push(diagnostic('EXTRA_CELL', location, id));
      if (cells.length < headers.length) diagnostics.push(diagnostic('MISSING_CELL', location, id));
      return {
        id,
        location,
        data,
        raw: cells,
        ...(options.classification
          ? {
              range,
              sourceRecord: text.slice(range.start, range.end),
              sourceEntries: columns.map((column, j) => ({
                column,
                header: headerless ? null : headers[j],
                value: cells[j] ?? null
              }))
            }
          : {})
      };
    });
  } else throw failure('UNSUPPORTED_FORMAT', 'parse');
  const seen = new Map();
  for (const r of records) {
    const key = JSON.stringify(r.raw);
    if (seen.has(key))
      diagnostics.push({
        ...diagnostic('DUPLICATE', r.location, r.id),
        duplicateOf: seen.get(key)
      });
    else seen.set(key, r.id);
  }
  return {
    text,
    records,
    columns,
    delimiter,
    headerless,
    structured,
    diagnostics,
    counts: {
      total: records.length,
      parsed: records.length,
      processed: 0,
      unresolved: records.length,
      warnings: diagnostics.length,
      errors: 0
    }
  };
}
export async function parseInput(input, options = {}) {
  if (!(input?.bytes instanceof Uint8Array) || input.bytes.byteLength > MAX_INPUT_BYTES)
    throw failure('INPUT_TOO_LARGE_OR_INVALID', 'read');
  options.cancellation?.throwIfAborted();
  const bytes = input.bytes;
  let encoding = options.encoding || 'utf-8',
    assumed = !options.encoding;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
    assumed = false;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
    assumed = false;
  } else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'utf-8';
    assumed = false;
  }
  if (assumed && options.classification && bytes.length >= 16 && bytes.length % 2 === 0) {
    const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
    let even = 0,
      odd = 0;
    for (let i = 0; i < sample.length; i++)
      if (sample[i] === 0) {
        if (i % 2) odd++;
        else even++;
      }
    if (odd > sample.length / 8 && even < odd / 4) encoding = 'utf-16le';
    else if (even > sample.length / 8 && odd < even / 4) encoding = 'utf-16be';
  }
  if (!['utf-8', 'utf-16le', 'utf-16be', 'windows-1251'].includes(encoding))
    throw failure('UNSUPPORTED_ENCODING', 'read');
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    if (!assumed || !options.classification || encoding !== 'utf-8')
      throw failure('INVALID_ENCODING', 'read');
    const candidate = new TextDecoder('windows-1251', { fatal: true }).decode(bytes);
    // Single-byte encodings cannot be identified universally. Only accept a
    // Cyrillic structured record; keep diagnostics and manual post-import override.
    if (
      !/[А-Яа-яЁё]{3}/u.test(candidate) ||
      !/(?:^|[|\n])\s*(?:id|email|name|фио|почта)[:=]/iu.test(candidate) ||
      /[\u0000-\u0008\u000e-\u001f]/u.test(candidate)
    )
      throw failure('INVALID_ENCODING', 'read');
    encoding = 'windows-1251';
    text = candidate;
  }
  const format = options.format || (input.originalName || '').split('.').pop().toLowerCase();
  const parsed = parseText(text, format, options);
  if (assumed) {
    parsed.diagnostics.unshift(diagnostic('ENCODING_ASSUMED'));
    parsed.counts.warnings++;
  }
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  options.cancellation?.throwIfAborted();
  return {
    ...parsed,
    sourceId: input.sourceId || null,
    originalName: input.originalName,
    sourceBytes: bytes,
    sourceHash: Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join(''),
    format,
    encoding,
    encodingAssumed: assumed
  };
}
