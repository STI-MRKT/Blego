const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cases } = require('../fixtures/classifier-v142.cjs');
for (const fixture of cases)
  test(`TZ9 classifier: ${fixture.name}`, async () => {
    const { parseInput } = await import('../../shared/importer.mjs');
    const { classifyRecords, CLASSIFIER_FIELDS } = await import('../../shared/classifier.mjs');
    const parsed = await parseInput(
      { bytes: Buffer.from(fixture.text), originalName: 'synthetic.txt' },
      { classification: true }
    );
    const { records } = classifyRecords(parsed);
    assert.equal(records.length, fixture.expected.length);
    for (const [i, row] of records.entries()) {
      for (const { key } of CLASSIFIER_FIELDS.filter((f) => f.key !== 'rowNumber'))
        assert.equal(row.data[key], fixture.expected[i][key] || '', `row ${i}, ${key}`);
      assert.equal(fixture.text.slice(row.range.start, row.range.end), row.sourceRecord);
      for (const key of Object.keys(fixture.expected[i]))
        assert.ok(row.fieldSources[key]?.length, `provenance ${key}`);
    }
    if (fixture.review) assert.ok(records.some((r) => r.confidence === 'review'));
  });
