const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const { parseInput } = await import('../../../shared/importer.mjs');
    const { classifyRecords } = await import('../../../shared/classifier.mjs');
    const parsed = await parseInput(workerData.input, {
      ...workerData.options,
      classification: true
    });
    parentPort.postMessage({
      ok: true,
      value: { parsed, classified: classifyRecords(parsed, workerData.options) }
    });
  } catch (e) {
    parentPort.postMessage({ ok: false, code: e.code || 'PARSE_FAILED' });
  }
})();
