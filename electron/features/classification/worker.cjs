const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const { parseInput } = await import('../../../shared/importer.mjs');
    parentPort.postMessage({
      ok: true,
      value: await parseInput(workerData.input, workerData.options)
    });
  } catch (e) {
    parentPort.postMessage({ ok: false, code: e.code || 'PARSE_FAILED' });
  }
})();
