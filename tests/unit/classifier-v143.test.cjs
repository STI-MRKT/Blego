const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cases } = require('../fixtures/classifier-v143.cjs');
for (const fixture of cases)
  test(`TZ11 TXT: ${fixture.name}`, async () => {
    const { parseInput } = await import('../../shared/importer.mjs');
    const { classifyRecords } = await import('../../shared/classifier.mjs');
    const parsed = await parseInput(
      { bytes: Buffer.from(fixture.text), originalName: 'synthetic.txt' },
      { classification: true, ...fixture.options }
    );
    const result = classifyRecords(parsed, fixture.options);
    assert.equal(result.records.length, fixture.expected.length);
    for (const [i, row] of result.records.entries()) {
      const actual = { ...row.data, ...row.extended };
      delete actual.rowNumber;
      for (const key of Object.keys(actual))
        assert.equal(actual[key], fixture.expected[i][key] || '', `row ${i} ${key}`);
      for (const [key, value] of Object.entries(fixture.expected[i])) {
        assert.equal(actual[key], value, key);
        assert.ok(row.fieldSources[key]?.length, key);
      }
      assert.equal(fixture.text.slice(row.range.start, row.range.end), row.sourceRecord);
    }
    if (fixture.review) assert.ok(result.records.some((r) => r.confidence === 'review'));
  });
