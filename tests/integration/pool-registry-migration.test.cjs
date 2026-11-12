const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const { writeZip } = require('../../electron/features/archive/zip.cjs');

test('package preview/apply keeps registry; changed or invalid imports cannot switch active dataset', async (t) => {
  const {
    createPoolCatalog,
    getPoolStats
  } = require('../../electron/features/generator/catalog.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-pool-'));
  let store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let catalog = createPoolCatalog({ store });
  const first = await generateProfile(
    { country: 'BR', type: 'model', requestId: 'old' },
    { store }
  );
  const oldCount = store.db.prepare('SELECT count(*) n FROM issued').get().n;
  const data = JSON.parse(fs.readFileSync('resources/generator/countries/BR.json', 'utf8'));
  data.first = ['Amélia'];
  data.last = ['Silva'];
  data.datasetVersion = 'test-v2';
  delete data.checksum;
  data.checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const file = path.join(root, 'package.json');
  fs.writeFileSync(file, JSON.stringify(data));
  const preview = await catalog.preview(file);
  assert.equal(preview.counts.firstNames, 1);
  assert.equal(getPoolStats({ country: 'BR', type: 'model' }, { store }).counts.firstNames, 81);
  await catalog.apply(preview.fileToken);
  assert.equal(store.db.prepare('SELECT count(*) n FROM issued').get().n, oldCount);
  const next = await generateProfile({ country: 'BR', type: 'model', requestId: 'new' }, { store });
  assert.equal(next.fields.name, 'Amélia Silva');
  assert.notEqual(next.fields.phone, first.fields.phone);
  assert.equal(next.datasetVersion, 'test-v2');
  const savedCount = store.db.prepare('SELECT count(*) n FROM issued').get().n;
  store.close();
  store = await openStore(root);
  catalog = createPoolCatalog({ store });
  assert.equal(store.db.prepare('SELECT count(*) n FROM issued').get().n, savedCount);
  const version = getPoolStats({ country: 'BR', type: 'model' }, { store }).installedVersions[0];
  catalog.useBundled('BR');
  assert.equal(getPoolStats({ country: 'BR', type: 'model' }, { store }).counts.firstNames, 81);
  catalog.select('BR', version.key);
  assert.equal(getPoolStats({ country: 'BR', type: 'model' }, { store }).counts.firstNames, 1);
  const second = await catalog.preview(file);
  fs.appendFileSync(file, ' ');
  await assert.rejects(catalog.apply(second.fileToken), { message: 'SOURCE_CHANGED' });
  fs.writeFileSync(file, '{"script":"malicious"}');
  await assert.rejects(catalog.preview(file), { message: 'DATASET_INVALID' });
  assert.equal(
    getPoolStats({ country: 'BR', type: 'model' }, { store }).datasetVersions.country,
    'test-v2'
  );
  await assert.rejects(catalog.apply('/etc/passwd'), { message: 'INVALID_FILE_TOKEN' });
  const zip = path.join(root, 'package.zip');
  await writeZip(zip, { 'dataset.json': Buffer.from(JSON.stringify(data)) });
  const zipped = await catalog.preview(zip);
  assert.equal(zipped.counts.firstNames, 1);
  catalog.cancel(zipped.fileToken);
  await assert.rejects(catalog.apply(zipped.fileToken), { message: 'INVALID_FILE_TOKEN' });
  const deep = path.join(root, 'deep.zip');
  await writeZip(deep, { ['a/'.repeat(9) + 'dataset.json']: Buffer.from(JSON.stringify(data)) });
  await assert.rejects(catalog.preview(deep));
  const large = path.join(root, 'oversize.json');
  fs.writeFileSync(large, '');
  fs.truncateSync(large, 50 * 1024 * 1024 + 1);
  await assert.rejects(catalog.preview(large), { message: 'DATASET_INVALID' });
});
