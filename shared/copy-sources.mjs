// Explicit section allowlists. No DOM text, raw provider object or filesystem path is a source.
function assertPrecision(value) {
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    throw Error('COPY_PRECISION_LOST');
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) assertPrecision(child);
}
const scalar = (value) => {
  assertPrecision(value);
  return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
};
const secretKey = /password|passwd|secret|token|authorization|api.?key|cookie|credential/i;
function sanitizeStructured(value, mark) {
  if (Array.isArray(value)) return value.map((child) => sanitizeStructured(child, mark));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => {
          if (secretKey.test(key)) {
            mark();
            return false;
          }
          return true;
        })
        .map(([key, child]) => [key, sanitizeStructured(child, mark)])
    );
  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      if (['http:', 'https:', 'socks:', 'socks5:'].includes(url.protocol)) {
        let changed = Boolean(url.username || url.password);
        url.username = '';
        url.password = '';
        for (const key of [...url.searchParams.keys()])
          if (secretKey.test(key)) {
            url.searchParams.delete(key);
            changed = true;
          }
        if (changed) {
          mark();
          return url.href;
        }
      }
    } catch {
      /* A plain text cell is not interpreted as a URL. */
    }
  }
  return value;
}
const field = (key, sensitivity = 'public', kind) => ({ key, label: key, sensitivity, kind });
const rows = (items, values, id) =>
  items.map((item, index) => ({
    id: String(id?.(item, index) ?? index),
    values: values(item, index)
  }));
const fields = (keys) => keys.map((key) => field(key));
const pick = (obj, keys) => Object.fromEntries(keys.map((key) => [key, scalar(obj?.[key])]));
export function copySource(id, data) {
  if (id === 'biography') {
    const keys = [
      'residence',
      'birthplace',
      'employer',
      'position',
      'university',
      'school',
      'mainBio'
    ];
    return {
      fields: fields(keys),
      fieldOrder: keys,
      rows: data
        ? rows(
            [data],
            (r) => pick(r.values, keys),
            (r) => r.id
          )
        : []
    };
  }
  if (id === 'generator') {
    const keys = data?.fieldOrder || [];
    return {
      fields: fields(keys),
      fieldOrder: keys,
      mandatoryFields: ['phone', 'email'].filter((k) => keys.includes(k)),
      rows: data
        ? rows(
            [data],
            (p) =>
              Object.fromEntries(
                keys.map((k) => [
                  k,
                  Array.isArray(p.fields[k]) ? p.fields[k].join(', ') : scalar(p.fields[k])
                ])
              ),
            () => data.id || 'profile'
          )
        : []
    };
  }
  if (id === 'import') {
    const keys = data?.columns || [],
      redactions = new Set();
    const model = {
      fields: keys.map((key) => field(key, secretKey.test(key) ? 'secret' : 'public')),
      rows: []
    };
    for (const record of data?.records || []) {
      const values = Object.fromEntries(keys.map((key) => [key, scalar(record.data[key])]));
      const massValues = Object.fromEntries(
        keys.map((key) => [
          key,
          scalar(sanitizeStructured(record.data[key], () => redactions.add(key)))
        ])
      );
      model.rows.push({ id: String(record.id), values, massValues });
    }
    model.redactions = [...redactions];
    return model;
  }
  if (id === 'import-source')
    return {
      fields: [field('text', 'personal')],
      rows: [{ id: 'source', values: { text: data.text || '' } }]
    };
  if (id === 'import-diagnostics')
    return {
      fields: [field('diagnostic', 'personal')],
      rows: rows(data?.diagnostics || [], (r) => ({ diagnostic: scalar(r) }))
    };
  if (id === 'history') {
    const keys = ['originalName', 'processedAt', 'status', 'rulesVersion', 'lastOpenedAt'];
    return {
      fields: fields(keys),
      rows: rows(
        data?.items || [],
        (r) => pick(r, keys),
        (r) => r.archiveId
      ),
      filteredIds: data?.filteredIds
    };
  }
  if (id === 'archive-open')
    return {
      fields: [
        ...fields(['originalName', 'processedAt', 'status']),
        ...['resultText', 'unresolvedText', 'diagnostics'].map((k) => field(k, 'personal'))
      ],
      rows: rows(
        data ? [data] : [],
        (r) => ({
          ...pick(r.entry, ['originalName', 'processedAt', 'status']),
          ...pick(r, ['resultText', 'unresolvedText', 'diagnostics'])
        }),
        () => data.entry.archiveId
      )
    };
  if (id === 'checker')
    return {
      fields: [
        field('id', 'public', 'id'),
        field('link', 'public', 'url'),
        ...fields(['availability', 'banAssessment', 'reason', 'checkedAt']),
        field('ownerReports', 'personal')
      ],
      rows: rows(data || [], (r) => ({
        id: r.id || '',
        link: r.link || '',
        availability: r.check?.availability || 'not_checked',
        banAssessment: 'unknown',
        reason: r.check?.reasonCode || r.status || '',
        checkedAt: r.check?.checkedAt || '',
        ownerReports: scalar(
          (r.notes || []).map((n) => pick(n, ['status', 'reportedAt', 'comment', 'source']))
        )
      }))
    };
  if (id === 'network') {
    const keys = [
      'exitIp',
      'country',
      'provider',
      'mode',
      'protocol',
      'connection',
      'checkedAt',
      'code',
      'score',
      'scoreVersion',
      'sourceStatus',
      'factors'
    ];
    return {
      fields: fields(keys),
      rows: rows(
        data ? [data] : [],
        (r) => ({
          ...pick(r, keys.slice(0, 8)),
          score: scalar(r.assessment?.score),
          scoreVersion: r.assessment?.version || '',
          sourceStatus: scalar(
            (Array.isArray(r.sources) ? r.sources : []).map((s) =>
              pick(s, ['id', 'status', 'proxy', 'hosting', 'checkedAt'])
            )
          ),
          factors: scalar((r.assessment?.factors || []).map((f) => pick(f, ['flag', 'weight'])))
        }),
        () => 'proxy'
      )
    };
  }
  if (id === 'news') {
    const keys = ['title', 'source', 'publishedAt', 'link', 'description'];
    return {
      fields: keys.map((k) => field(k, 'public', k === 'link' ? 'url' : undefined)),
      rows: rows(
        data?.items || [],
        (r) => pick(r, keys),
        (r, i) => r.id || String(i)
      ),
      filteredIds: rows(
        (data?.items || []).filter((r) => !data.topic || r.topic === data.topic),
        () => ({}),
        (r, i) => r.id || String(data.items.indexOf(r))
      ).map((r) => r.id)
    };
  }
  if (id === 'photos') {
    const keys = [
      'title',
      'description',
      'author',
      'copyright',
      'keywords',
      'comment',
      'captureDate',
      'make',
      'model',
      'software',
      'iso',
      'fNumber',
      'exposureTime',
      'focalLength',
      'gps',
      'personalIdentifiers'
    ];
    return {
      fields: [
        field('name'),
        field('groupName'),
        field('effectiveOperations', 'personal'),
        ...keys.map((k) =>
          field(
            k,
            ['author', 'gps', 'captureDate', 'personalIdentifiers', 'comment'].includes(k)
              ? 'personal'
              : 'public'
          )
        ),
        field('warnings'),
        field('beforeAfter', 'personal')
      ],
      rows: rows(
        (data || []).filter((p) => p.view),
        (p) => ({
          name: p.name,
          groupName: p.groupName || '',
          effectiveOperations: scalar(
            p.effectiveOperations?.map(({ field, action, value, origin }) => ({
              field,
              action,
              ...(value === undefined ? {} : { value }),
              origin: origin?.kind
            }))
          ),
          ...Object.fromEntries(
            keys.map((k) => [k, scalar(p.view.tags.find((t) => t.field === k)?.value)])
          ),
          warnings: (p.view.warnings || []).join(', '),
          beforeAfter: scalar(p.beforeAfter)
        }),
        (p) => p.fileId
      )
    };
  }
  if (id === 'image-report') {
    const keys = [
      'groupName',
      'name',
      'startedAt',
      'finishedAt',
      'status',
      'changedFields',
      'verification',
      'outputName',
      'error',
      'sourceHash',
      'outputHash'
    ];
    return {
      fields: fields(keys),
      rows: rows(
        data?.files || [],
        (r) => pick(r, keys),
        (r) => r.fileId
      )
    };
  }
  throw Error('INVALID_COPY_SOURCE');
}
