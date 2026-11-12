/** Shared model-to-clipboard formatting. This module never reads or writes the clipboard.
 * A section adapter owns a complete (unpaginated) source, its field allowlist and
 * sensitivity declarations. The request selects only from that model.
 *
 * @typedef {{key:string,label?:string,kind?:string,sensitivity?:'public'|'personal'|'secret'|'internal'}} CopyField
 * @typedef {{fields:CopyField[],rows:{id:string,values:Object}[],fieldOrder?:string[],mandatoryFields?:string[],filteredIds?:string[]}} CopySource
 * @typedef {{scope:'value'|'card'|'selected'|'filter'|'all',sourceIds:string[],selection?:string[],format:string,orderedFields?:string[],safetyMode?:'raw'|'spreadsheet',includePersonal?:boolean}} CopyRequest
 * @typedef {{text:string,byteLength:number,rowCount:number,redactions:string[],warnings:string[]}} CopyPayload
 */
export const MAX_COPY_BYTES = 10 * 1024 * 1024;
const encoder = new TextEncoder();
const secretParameter =
  /^(?:password|passwd|pass|token|access_token|refresh_token|api_key|secret|authorization)$/i;
function fail(code) {
  throw Object.assign(new Error(code), { code, stage: 'copy' });
}
export function checkCopyText(text) {
  if (typeof text !== 'string') fail('INVALID_TEXT');
  const byteLength = encoder.encode(text).byteLength;
  if (byteLength > MAX_COPY_BYTES) fail('COPY_TOO_LARGE');
  return byteLength;
}
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
      fail('COPY_PRECISION_LOST');
    return String(value);
  }
  if (typeof value === 'boolean') return String(value);
  // Nested source values must be explicitly formatted by their owning section.
  // This prevents an unreviewed object from bypassing the flat field allowlist.
  fail('INVALID_COPY_VALUE');
}
function cleanUrl(text, field, redactions) {
  if (!text) return text;
  try {
    const url = new URL(text);
    let changed = Boolean(url.username || url.password);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) {
      if (secretParameter.test(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) redactions.add(field);
    return changed ? url.href : text;
  } catch {
    // An invalid URL cannot be safely inspected for credentials.
    redactions.add(field);
    return '';
  }
}
function quoteTsv(text, format) {
  return (format === 'csv' ? /[,\r\n"]/ : /[\t\r\n"]/).test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}
function protectCell(text, field, warnings) {
  if (
    /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) ||
    /^\s*\d+\s*$/u.test(text) ||
    (text && ['phone', 'id', 'postalCode'].includes(field.kind || field.key))
  ) {
    warnings.add('SPREADSHEET_VALUES_ESCAPED');
    return `'${text}`;
  }
  return text;
}

/** @param {CopyRequest} request
 * @param {{resolveSource:(id:string)=>Promise<CopySource>,revealedFields?:string[],yieldControl?:()=>Promise<void>}} context
 * @returns {Promise<CopyPayload>}
 */
export async function serializeCopy(request, context) {
  if (!request || !Array.isArray(request.sourceIds) || request.sourceIds.length !== 1)
    fail('INVALID_COPY_SOURCE');
  const { scope, format } = request;
  if (!['value', 'card', 'selected', 'filter', 'all'].includes(scope)) fail('INVALID_COPY_SCOPE');
  if (!['text', 'values', 'labelled', 'json', 'tsv', 'csv'].includes(format))
    fail('INVALID_COPY_FORMAT');
  if (scope === 'value' && format !== 'text') fail('INVALID_COPY_FORMAT');
  if (['tsv', 'csv'].includes(format) && !['raw', 'spreadsheet'].includes(request.safetyMode))
    fail('COPY_SAFETY_REQUIRED');
  const source = await context.resolveSource(request.sourceIds[0]);
  if (!source || !Array.isArray(source.rows) || !Array.isArray(source.fields))
    fail('INVALID_COPY_SOURCE');
  // Snapshot before any yielding: a live feed must not change a partly prepared report.
  const model = structuredClone(source);
  const fieldMap = new Map(model.fields.map((field) => [field.key, field]));
  if (fieldMap.size !== model.fields.length) fail('INVALID_COPY_SOURCE');
  let keys = request.orderedFields ?? model.fieldOrder ?? model.fields.map((field) => field.key);
  if (!Array.isArray(keys) || keys.some((key) => !fieldMap.has(key))) fail('INVALID_COPY_FIELDS');
  if (scope === 'value' && keys.length !== 1) fail('INVALID_COPY_FIELDS');
  keys = [...new Set([...keys, ...(scope === 'card' ? model.mandatoryFields || [] : [])])];
  if (keys.some((key) => !fieldMap.has(key))) fail('INVALID_COPY_FIELDS');
  const rows = new Map(model.rows.map((row) => [row.id, row]));
  if (rows.size !== model.rows.length) fail('INVALID_COPY_SOURCE');
  const ids =
    scope === 'all' ? [...rows.keys()] : scope === 'filter' ? model.filteredIds : request.selection;
  if (!Array.isArray(ids) || ids.some((id) => !rows.has(id))) fail('COPY_SELECTION_CHANGED');
  if (['value', 'card'].includes(scope) && ids.length !== 1) fail('INVALID_COPY_SELECTION');
  const selected = [...new Set(ids)].map((id) => rows.get(id));
  const redactions = new Set(scope === 'value' ? [] : model.redactions || []);
  const warnings = new Set();
  const fields = keys
    .map((key) => fieldMap.get(key))
    .filter((field) => {
      const sensitivity = field.sensitivity || 'public';
      const allowed =
        sensitivity === 'public' ||
        (scope === 'value' &&
          sensitivity !== 'internal' &&
          context.revealedFields?.includes(field.key)) ||
        (scope !== 'value' && sensitivity === 'personal' && request.includePersonal === true);
      if (!allowed) {
        if (scope === 'value') fail('COPY_DISCLOSURE_REQUIRED');
        redactions.add(field.key);
      } else if (sensitivity === 'personal') warnings.add('PERSONAL_DATA_INCLUDED');
      return allowed;
    });
  if (['tsv', 'csv'].includes(format) && request.safetyMode === 'raw')
    warnings.add('RAW_SPREADSHEET_VALUES');
  let byteLength = 0;
  const chunks = [];
  function append(text) {
    byteLength += encoder.encode(text).byteLength;
    if (byteLength > MAX_COPY_BYTES) fail('COPY_TOO_LARGE');
    chunks.push(text);
  }
  const tableCell = (value, field) =>
    quoteTsv(
      request.safetyMode === 'spreadsheet' ? protectCell(value, field, warnings) : value,
      format
    );
  if (format === 'json') append('[');
  if (['tsv', 'csv'].includes(format))
    append(
      fields
        .map((field) => tableCell(field.label || field.key, field))
        .join(format === 'csv' ? ',' : '\t')
    );
  const yieldControl =
    context.yieldControl || (() => new Promise((resolve) => setTimeout(resolve, 0)));
  for (let index = 0; index < selected.length; index++) {
    const row = selected[index];
    const values = fields.map((field) => {
      const values = scope !== 'value' && row.massValues ? row.massValues : row.values;
      const value = cellText(Object.hasOwn(values, field.key) ? values[field.key] : null);
      return scope !== 'value' && field.kind === 'url'
        ? cleanUrl(value, field.key, redactions)
        : value;
    });
    if (format === 'json') {
      if (index) append(',');
      append(JSON.stringify(Object.fromEntries(fields.map((field, i) => [field.key, values[i]]))));
    } else if (['tsv', 'csv'].includes(format)) {
      append(
        '\n' +
          values.map((value, i) => tableCell(value, fields[i])).join(format === 'csv' ? ',' : '\t')
      );
    } else {
      if (index) append('\n\n');
      append(
        values
          .map((value, i) =>
            format === 'labelled' ? `${fields[i].label || fields[i].key}: ${value}` : value
          )
          .join('\n')
      );
    }
    if ((index + 1) % 256 === 0) await yieldControl();
  }
  if (format === 'json') append(']');
  return {
    text: chunks.join(''),
    byteLength,
    rowCount: selected.length,
    redactions: [...redactions],
    warnings: [...warnings]
  };
}
