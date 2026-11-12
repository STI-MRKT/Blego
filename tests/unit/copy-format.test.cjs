const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = () => import(pathToFileURL(path.resolve('shared/copy-format.mjs')));
function context(rows, options = {}) {
  const source = {
    fields: [{ key: 'value', label: 'Value' }],
    rows: rows.map((value, i) => ({ id: String(i), values: { value } })),
    ...options
  };
  return { resolveSource: async (id) => (id === 'test' ? source : null) };
}
const request = (extra = {}) => ({
  sourceIds: ['test'],
  scope: 'all',
  format: 'json',
  ...extra
});

test('single_value_is_exact, absent values stay empty', async () => {
  const { serializeCopy } = await load();
  for (const value of [
    '  Łucía\nÉva  ',
    '001234',
    '+5511999999999',
    '12345678901234567890123',
    '—',
    null,
    undefined
  ]) {
    const payload = await serializeCopy(
      request({
        scope: 'value',
        selection: ['0'],
        orderedFields: ['value'],
        format: 'text',
        safetyMode: 'spreadsheet'
      }),
      context([value])
    );
    assert.equal(payload.text, value ?? '');
    assert.equal(payload.byteLength, Buffer.byteLength(value ?? ''));
  }
});

test('card_obeys_saved_order and mandatory profile contacts cannot be omitted', async () => {
  const { serializeCopy } = await load();
  const ctx = context([], {
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' }
    ],
    fieldOrder: ['email', 'name', 'phone'],
    mandatoryFields: ['phone', 'email'],
    rows: [{ id: '0', values: { name: 'Łucía', phone: '+001', email: 'a@example.net' } }]
  });
  const out = await serializeCopy(
    request({ scope: 'card', selection: ['0'], format: 'values' }),
    ctx
  );
  assert.equal(out.text, 'a@example.net\nŁucía\n+001');
  const required = await serializeCopy(
    request({ scope: 'card', selection: ['0'], orderedFields: ['name'], format: 'labelled' }),
    ctx
  );
  assert.equal(required.text, 'Name: Łucía\nPhone: +001\nEmail: a@example.net');
});

test('copy_filter_includes_offscreen_rows; selected rows span pages; all includes 120', async () => {
  const { serializeCopy } = await load();
  const ctx = context(
    Array.from({ length: 120 }, (_, i) => `row ${i}`),
    { filteredIds: ['100', '40', '1'], pageSize: 20 }
  );
  const selected = await serializeCopy(
    request({ scope: 'selected', selection: ['1', '40', '100'] }),
    ctx
  );
  assert.deepEqual(JSON.parse(selected.text), [
    { value: 'row 1' },
    { value: 'row 40' },
    { value: 'row 100' }
  ]);
  assert.equal(selected.rowCount, 3);
  const filtered = await serializeCopy(request({ scope: 'filter' }), ctx);
  assert.deepEqual(JSON.parse(filtered.text), [
    { value: 'row 100' },
    { value: 'row 40' },
    { value: 'row 1' }
  ]);
  assert.equal((await serializeCopy(request(), ctx)).rowCount, 120);
  await assert.rejects(serializeCopy(request({ scope: 'selected', selection: ['missing'] }), ctx), {
    code: 'COPY_SELECTION_CHANGED'
  });
});

// Independent parser checks the actual public TSV representation, including multiline cells.
function parseTsv(input) {
  const rows = [];
  let row = [],
    value = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === '\t' || c === '\n')) {
      row.push(value);
      value = '';
      if (c === '\n') {
        rows.push(row);
        row = [];
      }
    } else value += c;
  }
  row.push(value);
  rows.push(row);
  return rows;
}
test('tsv_quotes_roundtrip and explicit spreadsheet safety preserves raw single copying', async () => {
  const { serializeCopy } = await load();
  const values = [
    'a\tb',
    'a\nb',
    '"quoted"',
    '=1+1',
    ' +SUM(1)',
    '\t@cmd',
    '\r-1',
    '000001',
    '12345678901234567890'
  ];
  const raw = await serializeCopy(request({ format: 'tsv', safetyMode: 'raw' }), context(values));
  assert.deepEqual(parseTsv(raw.text), [['Value'], ...values.map((x) => [x])]);
  assert.ok(raw.warnings.includes('RAW_SPREADSHEET_VALUES'));
  const safe = await serializeCopy(
    request({ format: 'tsv', safetyMode: 'spreadsheet' }),
    context(values)
  );
  assert.deepEqual(parseTsv(safe.text), [
    ['Value'],
    ['a\tb'],
    ['a\nb'],
    ['"quoted"'],
    ["'=1+1"],
    ["' +SUM(1)"],
    ["'\t@cmd"],
    ["'\r-1"],
    ["'000001"],
    ["'12345678901234567890"]
  ]);
  assert.ok(safe.warnings.includes('SPREADSHEET_VALUES_ESCAPED'));
  await assert.rejects(serializeCopy(request({ format: 'tsv' }), context(['x'])), {
    code: 'COPY_SAFETY_REQUIRED'
  });
});

test('mass_report_excludes_secrets and personal fields require deliberate disclosure', async () => {
  const { serializeCopy } = await load();
  const ctx = context([], {
    fields: [
      { key: 'ip', label: 'IP' },
      { key: 'password', sensitivity: 'secret' },
      { key: 'gps', sensitivity: 'personal' },
      { key: 'path', sensitivity: 'internal' },
      { key: 'url', kind: 'url' }
    ],
    rows: [
      {
        id: '0',
        values: {
          ip: '192.0.2.1',
          password: 'not-a-real-secret',
          gps: '1,2',
          path: '/private/test',
          url: 'https://login:password@example.test/path?token=private&view=1'
        }
      }
    ]
  });
  const safe = await serializeCopy(request(), ctx);
  assert.deepEqual(JSON.parse(safe.text), [
    { ip: '192.0.2.1', url: 'https://example.test/path?view=1' }
  ]);
  assert.deepEqual(new Set(safe.redactions), new Set(['password', 'gps', 'path', 'url']));
  const full = await serializeCopy(request({ includePersonal: true }), ctx);
  assert.equal(JSON.parse(full.text)[0].gps, '1,2');
  assert.equal(JSON.parse(full.text)[0].password, undefined);
  assert.ok(full.warnings.includes('PERSONAL_DATA_INCLUDED'));
  const single = request({
    scope: 'value',
    selection: ['0'],
    orderedFields: ['password'],
    format: 'text'
  });
  await assert.rejects(serializeCopy(single, ctx), { code: 'COPY_DISCLOSURE_REQUIRED' });
  ctx.revealedFields = ['password'];
  assert.equal((await serializeCopy(single, ctx)).text, 'not-a-real-secret');
});

test('over_10_mib rejects before exposing a partial payload; input model snapshot survives yields', async () => {
  const { serializeCopy } = await load();
  await assert.rejects(
    serializeCopy(
      request({ scope: 'value', selection: ['0'], orderedFields: ['value'], format: 'text' }),
      context(['é'.repeat(5 * 1024 * 1024 + 1)])
    ),
    { code: 'COPY_TOO_LARGE' }
  );
  const source = {
    fields: [{ key: 'value' }],
    rows: Array.from({ length: 600 }, (_, i) => ({ id: String(i), values: { value: String(i) } }))
  };
  let yielded = 0;
  const out = await serializeCopy(request(), {
    resolveSource: async () => source,
    yieldControl: async () => {
      yielded++;
      source.rows[599].values.value = 'changed';
    }
  });
  assert.ok(yielded > 0);
  assert.equal(JSON.parse(out.text)[599].value, '599');
});
