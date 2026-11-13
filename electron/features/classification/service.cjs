const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { EXTENDED_FIELDS } = require('../../../shared/classifier-recognition.mjs');
const { CORE_FIELDS, CLASSIFIER_FIELDS } = require('../../../shared/classifier.mjs');
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
    const unresolved = classified.records.filter(
      (r) =>
        r.unrecognized.length ||
        r.warnings?.length ||
        !Object.entries(r.data).some(([k, v]) => k !== 'rowNumber' && v)
    );
    const old = operations.get(operationId);
    const o = {
      operationId,
      parsed,
      options,
      ...classified,
      status:
        unresolved.length || !classified.records.length ? 'preview_partial' : 'preview_complete',
      unresolved,
      // Explicit archive confirmation persists the seven agreed fields only.
      resultText: [
        CORE_FIELDS.join('\t'),
        ...classified.records.map((r) =>
          CORE_FIELDS.map((k) => {
            let value = r.data[k];
            if (/^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^\d+$/.test(value)) value = "'" + value;
            return /[\t\r\n"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
          }).join('\t')
        )
      ].join('\n'),
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
  function getConfirmed(id) {
    const o = get(id);
    if (!['completed', 'partial_confirmed'].includes(o.status)) throw Error('NOT_CLASSIFIED');
    return structuredClone(o);
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
