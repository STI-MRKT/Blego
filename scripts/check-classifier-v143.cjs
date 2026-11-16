const fs = require('node:fs');
const { cases } = require('../tests/fixtures/classifier-v143.cjs');
(async () => {
  const { parseInput } = await import('../shared/importer.mjs');
  const { classifyRecords } = await import('../shared/classifier.mjs');
  const results = [];
  for (const fixture of cases) {
    const start = performance.now();
    const parsed = await parseInput(
      { bytes: Buffer.from(fixture.text), originalName: 'synthetic.txt' },
      { classification: true, ...fixture.options }
    );
    const { records } = classifyRecords(parsed, fixture.options);
    const fields = {};
    let correct = 0,
      missing = 0,
      falseAssignments = 0;
    for (const [i, row] of records.entries())
      for (const [key, value] of Object.entries({ ...row.data, ...row.extended })) {
        if (key === 'rowNumber') continue;
        const expected = fixture.expected[i]?.[key] || '';
        fields[key] ||= { correct: 0, missing: 0, falseAssignments: 0 };
        if (value && value === expected) {
          correct++;
          fields[key].correct++;
        } else {
          if (value) {
            falseAssignments++;
            fields[key].falseAssignments++;
          }
          if (expected) {
            missing++;
            fields[key].missing++;
          }
        }
      }
    results.push({
      name: fixture.name,
      records: records.length,
      expectedRecords: fixture.expected.length,
      correct,
      missing,
      falseAssignments,
      precision: correct / (correct + falseAssignments || 1),
      recall: correct / (correct + missing || 1),
      ambiguous: records.filter((r) => r.confidence === 'review').length,
      durationMs: performance.now() - start,
      fields
    });
  }
  const report = {
    os: process.platform,
    arch: process.arch,
    node: process.version,
    at: new Date().toISOString(),
    cases: results,
    status: results.every(
      (r) => !r.missing && !r.falseAssignments && r.records === r.expectedRecords
    )
      ? 'PASS'
      : 'FAIL'
  };
  if (!process.argv[2]) throw Error('REPORT_PATH_REQUIRED');
  fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      cases: results.length,
      records: results.reduce((n, r) => n + r.records, 0)
    })
  );
  if (report.status !== 'PASS') process.exitCode = 1;
})();
