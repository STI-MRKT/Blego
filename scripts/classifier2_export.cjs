// Read-only A/B benchmark bridge. The repository under --engine supplies its
// own importer and classifier; this script supplies only synthetic cases.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const [engineRoot, datasetPath, outputPath] = process.argv.slice(2);
  if (!engineRoot || !datasetPath || !outputPath) throw Error('ENGINE_DATASET_OUTPUT_REQUIRED');
  const engine = fs.realpathSync(engineRoot);
  const { parseInput } = await import(pathToFileURL(path.join(engine, 'shared/importer.mjs')));
  const { classifyRecords } = await import(
    pathToFileURL(path.join(engine, 'shared/classifier.mjs'))
  );
  const cases = fs.readFileSync(datasetPath, 'utf8').trimEnd().split('\n').map(JSON.parse);
  const results = [];
  for (const item of cases) {
    const started = performance.now();
    try {
      const parsed = await parseInput(
        { bytes: Buffer.from(item.text), originalName: `synthetic.${item.format}` },
        { classification: true }
      );
      const classified = classifyRecords(parsed);
      results.push({
        id: item.id,
        durationMs: performance.now() - started,
        records: classified.records.map((record, index) => ({
          data: record.data,
          extended: record.extended,
          warnings: record.warnings?.map((warning) => warning.code) || [],
          entries:
            parsed.records[index]?.sourceEntries?.map((entry) => ({
              header: entry.header || '',
              column: entry.column,
              value: entry.value,
              labelled: Boolean(entry.labelled),
              range: entry.range || null
            })) || []
        }))
      });
    } catch (error) {
      results.push({
        id: item.id,
        durationMs: performance.now() - started,
        records: [],
        error: error.code || error.name || 'ERROR'
      });
    }
  }
  fs.writeFileSync(outputPath, JSON.stringify({ engine, results }, null, 2) + '\n');
  console.log(
    JSON.stringify({
      engine,
      cases: results.length,
      errors: results.filter((result) => result.error).length
    })
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
