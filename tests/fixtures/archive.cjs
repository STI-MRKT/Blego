const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const {
  createClassificationService
} = require('../../electron/features/classification/service.cjs');
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-archive-'));
  const store = await openStore(root);
  const classification = createClassificationService({
    allowTestRules: true,
    clock: () => new Date('2026-11-12T10:30:00Z')
  });
  t.after(() => {
    classification.close();
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const { parseInput } = await import('../../shared/importer.mjs');
  const parsed = await parseInput({ bytes: Buffer.from('Тест\n?'), originalName: 'пример.txt' });
  const result = classification.classifyDocument(parsed, {
    testOnly: true,
    version: 'TEST-ONLY-1',
    classify: (r) => (r.data.text === '?' ? null : r.data.text)
  });
  classification.confirmClassification(result.operationId, 'accept_partial');
  return { root, store, classification, id: result.operationId };
}
module.exports = { fixture };
