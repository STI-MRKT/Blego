const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  EXTENDED_FIELDS,
  recognizeValue,
  recognizeLabelledValue
} = require('../../../shared/classifier-recognition.mjs');
const {
  CORE_FIELDS,
  SCHEMAS,
  CLASSIFIER_FIELDS,
  fieldForHeader,
  validBirthDate
} = require('../../../shared/classifier.mjs');
function archiveText(records) {
  return [
    CORE_FIELDS.join('\t'),
    ...records.map((r) =>
      CORE_FIELDS.map((k) => {
        let value = r.data[k];
        if (/^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^\d+$/.test(value)) value = "'" + value;
        return /[\t\r\n"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
      }).join('\t')
    )
  ].join('\n');
}
function createClassificationService({ allowTestRules = false, clock = () => new Date() } = {}) {
  const operations = new Map(),
    jobs = new Map();
  function get(id) {
    const o = operations.get(id);
    if (!o) throw Error('UNKNOWN_OPERATION');
    if (jobs.has(id)) throw Error('OPERATION_BUSY');
    return o;
  }
  function classifyDocument(parsed, rules = null) {
    if (rules && (!allowTestRules || rules.testOnly !== true)) throw Error('RULES_NOT_CONFIGURED');
    const operationId = randomUUID();
    const base = {
      operationId,
      status: 'rules_pending',
      rulesVersion: null,
      records: [],
      unresolved: parsed.records,
      diagnostics: parsed.diagnostics,
      counts: parsed.counts,
      parsed,
      sessionStartedAt: clock().toISOString()
    };
    if (rules) {
      const records = [],
        unresolved = [];
      for (const r of parsed.records) {
        const value = rules.classify(r);
        if (value === null) unresolved.push(r);
        else if (typeof value === 'string') records.push({ id: r.id, text: value });
        else throw Error('INVALID_RULE_RESULT');
      }
      Object.assign(base, {
        status: unresolved.length ? 'preview_partial' : 'preview_complete',
        rulesVersion: rules.version,
        testOnly: true,
        records,
        unresolved,
        resultText: records.map((r) => r.text).join('\n'),
        unresolvedText: unresolved.map((r) => JSON.stringify(r.raw)).join('\n'),
        counts: { ...parsed.counts, processed: records.length, unresolved: unresolved.length }
      });
    }
    operations.set(operationId, base);
    return publicResult(base);
  }
  function publicResult(o) {
    return {
      operationId: o.operationId,
      status: o.status,
      rulesVersion: o.rulesVersion,
      counts: o.counts,
      processedAt: o.processedAt,
      encoding: o.parsed.encoding,
      encodingAssumed: o.parsed.encodingAssumed,
      originalName: o.parsed.originalName
    };
  }
  function adopt(parsed, classified, options, operationId = randomUUID()) {
    const old = operations.get(operationId);
    // Confidentiality belongs to the original source, not its latest assigned column.
    // It lasts for this in-memory operation and is never serialized into archive entries.
    const confidentialSources = [...(old?.confidentialSources || [])];
    const classifiedById = new Map(classified.records.map((r) => [r.id, r]));
    for (const source of parsed.records) {
      const record = classifiedById.get(source.id);
      const entries =
        source.sourceEntries ||
        Object.entries(source.data).map(([column, value]) => ({ column, value }));
      for (const [index, entry] of entries.entries()) {
        const rawValue = String(entry.value ?? '');
        const recognize = entry.labelled
          ? (...args) => recognizeLabelledValue(entry.header, ...args)
          : recognizeValue;
        const found = recognize(rawValue, fieldForHeader, validBirthDate, (s) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
        );
        const named = !parsed.headerless && fieldForHeader(entry.header ?? entry.column, rawValue);
        const schema = SCHEMAS[options.schema];
        const role = schema && entries.length === schema.length ? schema[index] : null;
        if (
          rawValue &&
          (named === 'twoFactorCode' ||
            role === 'twoFactorCode' ||
            found.key === 'twoFactorCode' ||
            record?.fieldSources.twoFactorCode?.some((s) => s.column === entry.column))
        ) {
          confidentialSources.push({
            rawValue,
            value: found.key === 'twoFactorCode' ? found.value : rawValue,
            range: entry.range || null
          });
        }
      }
    }
    const protectedValues = new Set(
      confidentialSources.flatMap((s) => [s.rawValue, s.value]).filter(Boolean)
    );
    const protectedRanges = [];
    for (const range of confidentialSources
      .map((s) => s.range)
      .filter(Boolean)
      .sort((a, b) => a.start - b.start)) {
      const last = protectedRanges.at(-1);
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else protectedRanges.push({ ...range });
    }
    const overlapsProtected = (range) => {
      let low = 0,
        high = protectedRanges.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (protectedRanges[mid].start < range.end) low = mid + 1;
        else high = mid;
      }
      return low > 0 && protectedRanges[low - 1].end > range.start;
    };
    for (const record of classified.records)
      for (const field of CORE_FIELDS) {
        if (!record.data[field]) continue;
        const protectedSource = record.fieldSources[field]?.some((source) => {
          const entry = record.sourceEntries.find((e) => e.column === source.column);
          return (
            protectedValues.has(String(entry?.value ?? '')) ||
            (source.range && overlapsProtected(source.range))
          );
        });
        if (protectedValues.has(record.data[field]) || protectedSource)
          throw Error('CONFIDENTIAL_FIELD_MAPPING');
      }
    const unresolved = classified.records.filter(
      (r) =>
        r.unrecognized.length ||
        r.warnings?.length ||
        !Object.entries(r.data).some(([k, v]) => k !== 'rowNumber' && v)
    );
    const o = {
      operationId,
      parsed,
      options,
      ...classified,
      confidentialSources: [
        ...new Map(confidentialSources.map((s) => [JSON.stringify(s), s])).values()
      ],
      containsTwoFactor: Boolean(old?.containsTwoFactor || confidentialSources.length),
      status:
        unresolved.length || !classified.records.length ? 'preview_partial' : 'preview_complete',
      unresolved,
      // Explicit archive confirmation persists the seven agreed fields only.
      resultText: archiveText(classified.records),
      unresolvedText: unresolved
        .map((r) =>
          JSON.stringify({ recordId: r.recordId, location: r.location, code: 'REQUIRES_REVIEW' })
        )
        .join('\n'),
      counts: {
        ...parsed.counts,
        processed: classified.records.length - unresolved.length,
        unresolved: unresolved.length,
        warnings: classified.diagnostics.length
      },
      sessionStartedAt: old?.sessionStartedAt || clock().toISOString()
    };
    operations.set(operationId, o);
    return publicResult(o);
  }
  async function runWorker(input, options, jobId) {
    const worker = new Worker(path.join(__dirname, 'worker.cjs'), {
      workerData: {
        input,
        options: {
          format: options.format,
          encoding: options.encoding,
          headers: options.headers,
          schema: options.schema,
          mapping: options.mapping,
          recordMapping: options.recordMapping
        }
      },
      resourceLimits: { maxOldGenerationSizeMb: 512 }
    });
    return new Promise((resolve, reject) => {
      jobs.set(jobId, { worker, reject });
      worker.once('message', (r) => (r.ok ? resolve(r.value) : reject(Error(r.code))));
      worker.once('error', () => reject(Error('PARSE_FAILED')));
      worker.once('exit', (code) => {
        if (code) reject(Error('PARSE_FAILED'));
      });
    }).finally(() => {
      jobs.delete(jobId);
      worker.terminate();
    });
  }
  async function read(input, options = {}) {
    if (
      !input ||
      typeof input.requestId !== 'string' ||
      input.requestId.length > 100 ||
      jobs.has(input.requestId) ||
      operations.has(input.requestId) ||
      !(input.bytes instanceof Uint8Array) ||
      input.bytes.byteLength > 50 * 1024 * 1024 ||
      typeof input.originalName !== 'string' ||
      input.originalName.length > 255
    )
      throw Error('INVALID_INPUT');
    if (jobs.size >= 2 || operations.size + jobs.size >= 4) throw Error('TOO_MANY_OPERATIONS');
    const { parsed, classified } = await runWorker(input, options, input.requestId);
    return adopt(parsed, classified, options);
  }
  async function reclassify(id, options = {}) {
    const o = get(id);
    if (['completed', 'partial_confirmed'].includes(o.status)) throw Error('ALREADY_CONFIRMED');
    if (jobs.size >= 2) throw Error('TOO_MANY_OPERATIONS');
    const merged = { ...o.options, ...options };
    const { parsed, classified } = await runWorker(
      { bytes: o.parsed.sourceBytes, originalName: o.parsed.originalName },
      merged,
      id
    );
    if (!operations.has(id)) throw Error('CANCELLED');
    return adopt(parsed, classified, merged, id);
  }
  function confirmClassification(id, decision) {
    const o = get(id);
    if (['completed', 'partial_confirmed'].includes(o.status)) return publicResult(o);
    if (o.status === 'preview_complete' && decision === 'accept_complete') o.status = 'completed';
    else if (o.status === 'preview_partial' && decision === 'accept_partial')
      o.status = 'partial_confirmed';
    else throw Error('INVALID_CONFIRMATION');
    o.processedAt = clock().toISOString();
    o.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    o.offsetMinutes = -new Date(o.processedAt).getTimezoneOffset();
    return publicResult(o);
  }
  function getConfirmed(id, recordId) {
    const o = get(id);
    if (!['completed', 'partial_confirmed'].includes(o.status)) throw Error('NOT_CLASSIFIED');
    if (recordId === undefined) return structuredClone(o);
    if (typeof recordId !== 'string' || o.rulesVersion !== 'synthetic-records-1')
      throw Error('INVALID_RECORD');
    const record = o.records.find((r) => r.id === recordId);
    if (!record) throw Error('UNKNOWN_RECORD');
    o.archiveRecordIds ||= {};
    o.archiveRecordIds[recordId] ||= randomUUID();
    const result = structuredClone(o);
    result.operationId = o.archiveRecordIds[recordId];
    result.records = [structuredClone(record)];
    result.unresolved = o.unresolved.filter((r) => r.id === recordId);
    result.resultText = archiveText(result.records);
    result.diagnostics = o.diagnostics.filter((d) => d.recordId === recordId);
    result.unresolvedText = result.unresolved
      .map((r) => JSON.stringify({ recordId: r.id, location: r.location, code: 'REQUIRES_REVIEW' }))
      .join('\n');
    result.counts = {
      total: 1,
      processed: result.unresolved.length ? 0 : 1,
      unresolved: result.unresolved.length,
      warnings: result.diagnostics.length
    };
    result.status = result.unresolved.length ? 'partial_confirmed' : 'completed';
    return result;
  }
  function selectedRows(o, options = {}) {
    if (options.sort && !CLASSIFIER_FIELDS.some((f) => f.key === options.sort))
      throw Error('INVALID_SORT');
    if (options.query != null && (typeof options.query !== 'string' || options.query.length > 200))
      throw Error('INVALID_FILTER');
    if (options.warningsOnly != null && typeof options.warningsOnly !== 'boolean')
      throw Error('INVALID_FILTER');
    const query = (options.query || '').toLowerCase();
    const records = o.rulesVersion === 'synthetic-records-1' ? o.records : o.parsed.records;
    let result = query
      ? records.filter((r) =>
          CORE_FIELDS.some((k) =>
            String(r.data[k] || '')
              .toLowerCase()
              .includes(query)
          )
        )
      : records;
    if (options.warningsOnly)
      result = result.filter((r) => r.warnings?.length || r.unrecognized?.length);
    if (options.sort)
      result = [...result].sort((a, b) => {
        const aa = a.data[options.sort],
          bb = b.data[options.sort];
        const order =
          options.sort === 'rowNumber'
            ? Number(aa) - Number(bb)
            : String(aa).localeCompare(String(bb));
        return (options.descending ? -order : order) || Number(a.id) - Number(b.id);
      });
    return result;
  }
  function page(id, offset = 0, options = {}) {
    if (!Number.isInteger(offset) || offset < 0) throw Error('INVALID_PAGE');
    const o = get(id),
      p = o.parsed,
      all = selectedRows(o, options),
      records = all.slice(offset, offset + 50);
    return {
      ...publicResult(o),
      columns: o.columns || p.columns,
      sourceColumns: p.columns,
      headerless: p.headerless,
      delimiter: p.delimiter,
      offset,
      filteredTotal: all.length,
      records,
      diagnostics: o.diagnostics
        .filter((d) => !d.recordId || records.some((r) => r.id === d.recordId))
        .slice(0, 200)
    };
  }
  function cell(id, recordId, key) {
    if (typeof key !== 'string') throw Error('INVALID_FIELD');
    const r = get(id).records.find((r) => r.recordId === recordId);
    if (!r) throw Error('UNKNOWN_RECORD');
    if (CLASSIFIER_FIELDS.some((f) => f.key === key)) return r.data[key];
    if (EXTENDED_FIELDS.includes(key)) return r.extended[key];
    if (key === 'sourceRecord') return r.sourceRecord;
    if (key.startsWith('source:')) {
      const entry = r.sourceEntries.find((e) => e.column === key.slice(7));
      if (entry)
        return typeof entry.value === 'object'
          ? (entry.rawText ?? JSON.stringify(entry.value))
          : String(entry.value ?? '');
    }
    throw Error('INVALID_FIELD');
  }
  function cancel(id) {
    const job = jobs.get(id);
    if (job) {
      job.reject(Error('CANCELLED'));
      job.worker.terminate();
      jobs.delete(id);
    }
    operations.delete(id);
    return true;
  }
  return {
    read,
    classifyDocument,
    confirmClassification,
    getConfirmed,
    page,
    cell,
    async exportText(id, options = {}) {
      const o = get(id);
      let records = o.records;
      if (options.recordId) {
        records = records.filter((r) => r.recordId === options.recordId);
        if (!records.length) throw Error('UNKNOWN_RECORD');
      }
      const { classifierCopy } = require('../../../shared/classifier-copy.mjs');
      const text = await classifierCopy(records, {
        format: options.format || 'tsv',
        authorized: true
      });
      if (operations.get(id) !== o || jobs.has(id)) throw Error('CANCELLED');
      return text;
    },
    reclassify,
    cancel,
    sourceText: (id) => get(id).parsed.text,
    close() {
      for (const id of jobs.keys()) cancel(id);
      operations.clear();
    }
  };
}
module.exports = { createClassificationService };
