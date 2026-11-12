const { test } = require('node:test');
const assert = require('node:assert/strict');
test('explicit classifier copy/export includes exactly seven fields and protects spreadsheets', async () => {
  const { classifierCopy } = await import('../../shared/classifier-copy.mjs');
  const row = {
    recordId: '1',
    data: {
      fullName: '=1+1',
      accountId: '0009007199254740993123',
      password: 'FAKE_LOGIN',
      emailPassword: 'FAKE_MAIL',
      email: 'one@example.com',
      birthDate: '01.01.2000',
      geo: 'GB',
      userAgent: 'FAKE_UA',
      token: 'FAKE_TOKEN',
      cookies: 'FAKE_COOKIE'
    }
  };
  for (const format of ['tsv', 'csv']) {
    const text = await classifierCopy([row], { format, authorized: true });
    const { parseText } = await import('../../shared/importer.mjs');
    const p = parseText(text, format === 'tsv' ? 'tsv' : 'csv');
    assert.equal(p.columns.length, 7);
    assert.deepEqual(Object.values(p.records[0].data), [
      "'=1+1",
      "'0009007199254740993123",
      'FAKE_LOGIN',
      'FAKE_MAIL',
      'one@example.com',
      '01.01.2000',
      'GB'
    ]);
    assert.ok(!/FAKE_UA|FAKE_TOKEN|FAKE_COOKIE/.test(text));
  }
  assert.equal(row.data.accountId, '0009007199254740993123');
  assert.equal(row.data.fullName, '=1+1');
  await assert.rejects(classifierCopy([row], { format: 'tsv' }));
});
test('global import adapter still redacts passwords, cookie and tokens', async () => {
  const { copySource } = await import('../../shared/copy-sources.mjs');
  const { serializeCopy } = await import('../../shared/copy-format.mjs');
  const text = await serializeCopy(
    { scope: 'all', sourceIds: ['import'], format: 'json', includePersonal: true },
    {
      resolveSource: async () =>
        copySource('import', {
          columns: ['password', 'cookies', 'token', 'name'],
          records: [
            {
              id: '1',
              data: {
                password: 'FAKE_PASSWORD',
                cookies: 'FAKE_COOKIE',
                token: 'FAKE_TOKEN',
                name: 'Example'
              }
            }
          ]
        })
    }
  );
  assert.equal(text.text, '[{"name":"Example"}]');
});
