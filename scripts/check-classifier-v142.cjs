const { cases } = require('../tests/fixtures/classifier-v142.cjs');
(async () => {
  const { parseInput } = await import('../shared/importer.mjs');
  const { classifyRecords, CLASSIFIER_FIELDS } = await import('../shared/classifier.mjs');
  const start = performance.now();
  let correct = 0,
    falseAssignments = 0,
    missing = 0,
    ambiguous = 0,
    records = 0;
  for (const fixture of cases) {
    const parsed = await parseInput(
      { bytes: Buffer.from(fixture.text), originalName: 'synthetic.txt' },
      { classification: true }
    );
    const result = classifyRecords(parsed);
    if (result.records.length !== fixture.expected.length) throw Error('RECORD_BOUNDARIES_FAILED');
    for (const [i, row] of result.records.entries()) {
      records++;
      if (row.confidence === 'review') ambiguous++;
      for (const { key } of CLASSIFIER_FIELDS.filter((f) => f.key !== 'rowNumber')) {
        const expected = fixture.expected[i][key] || '',
          actual = row.data[key];
        if (actual && actual === expected) correct++;
        if (actual && actual !== expected) falseAssignments++;
        if (expected && actual !== expected) missing++;
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        host: process.platform + '-' + process.arch,
        datasets: cases.length,
        records,
        correctAssignments: correct,
        precision: correct / (correct + falseAssignments),
        recall: correct / (correct + missing),
        falseAssignments,
        missingValues: missing,
        ambiguousRecords: ambiguous,
        elapsedMs: Math.round((performance.now() - start) * 100) / 100
      },
      null,
      2
    )
  );
  if (falseAssignments || missing) process.exitCode = 1;
})().catch(() => {
  console.error('CLASSIFIER_QUALITY_FAILED');
  process.exitCode = 1;
});
