import { MAX_INPUT_BYTES, failure } from './contracts.mjs';
function diagnostic(code, location = {}, recordId = null, level = 'warning') {
  return { code, location, recordId, level };
}
function delimited(text, delimiter) {
  const rows = [];
  let cells = [],
    value = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  function cell() {
    cells.push(value);
    value = '';
    closed = false;
  }
  function row() {
    cell();
    rows.push({ cells, location: { startLine: start, endLine: line } });
    cells = [];
  }
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
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
      if (c === '\r' && text[i + 1] === '\n') i++;
      row();
      line++;
      start = line;
      continue;
    }
    if (closed) throw failure('TEXT_AFTER_QUOTE', 'parse', { line });
    value += c;
  }
  if (quoted) throw failure('UNCLOSED_QUOTE', 'parse', { line });
  if (value || cells.length || closed) row();
  return rows;
}
function delimiterOf(text) {
  let line = '',
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    if (!q && /[\r\n]/.test(c)) break;
    if (!q) line += c;
  }
  const counts = [',', ';', '\t']
    .map((d) => [d, line.split(d).length - 1])
    .sort((a, b) => b[1] - a[1]);
  if (counts[0][1] && counts[0][1] === counts[1][1]) throw failure('AMBIGUOUS_DELIMITER', 'parse');
  return counts[0][1] ? counts[0][0] : ',';
}
export function parseText(text, format) {
  text = text.replace(/^\uFEFF/, '');
  const diagnostics = [];
  let records = [],
    columns = [],
    delimiter = null;
  if (format === 'json') {
    let a;
    try {
      a = JSON.parse(text);
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
  } else if (format === 'txt') {
    columns = ['text'];
    records = (text === '' ? [] : text.split(/\r\n|\n|\r/)).map((value, i) => ({
      id: String(i + 1),
      location: { startLine: i + 1, endLine: i + 1 },
      data: { text: value },
      raw: value
    }));
  } else if (['csv', 'tsv'].includes(format)) {
    delimiter = format === 'tsv' ? '\t' : delimiterOf(text);
    const rows = delimited(text, delimiter);
    const headers = rows.shift()?.cells || [];
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
    records = rows.map(({ cells, location }, i) => {
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
      return { id, location, data, raw: cells };
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
  if (!['utf-8', 'utf-16le', 'utf-16be', 'windows-1251'].includes(encoding))
    throw failure('UNSUPPORTED_ENCODING', 'read');
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw failure('INVALID_ENCODING', 'read');
  }
  const format = options.format || (input.originalName || '').split('.').pop().toLowerCase();
  const parsed = parseText(text, format);
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
