const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openStore } = require('../../electron/local/store.cjs');
const { getSettings, updateSettings } = require('../../electron/local/settings.cjs');
test('TZ9 fresh defaults enable tools while stored false and partial choices survive reopening', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-settings-default-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const keys = ['proxyEnabled', 'facebookEnabled', 'newsEnabled'];
  let store = await openStore(root);
  assert.deepEqual(
    keys.map((k) => getSettings(store)[k]),
    [true, true, true]
  );
  for (const values of [
    [false, false, false],
    [true, false, true],
    [false, true, false]
  ]) {
    updateSettings(store, Object.fromEntries(keys.map((k, i) => [k, values[i]])));
    store.close();
    store = await openStore(root);
    assert.deepEqual(
      keys.map((k) => getSettings(store)[k]),
      values
    );
  }
  store.set('settings', { proxyEnabled: false, country: 'IT', type: 'crypto' });
  assert.deepEqual(
    keys.map((k) => getSettings(store)[k]),
    [false, true, true]
  );
  assert.equal(getSettings(store).country, 'IT');
  store.close();
});
test('TZ9 enabling tools and reading cached News does not initiate external requests', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-settings-network-'));
  const store = await openStore(root);
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let requests = 0;
  const news = require('../../electron/features/news/service.cjs').createNewsService({
    store,
    fetcher: async () => {
      requests++;
      throw Error('UNEXPECTED_NETWORK');
    }
  });
  const fb = require('../../electron/features/facebook/service.cjs').createFacebookService({
    store,
    transport: async () => {
      requests++;
      throw Error('UNEXPECTED_NETWORK');
    }
  });
  news.configure();
  news.snapshot();
  updateSettings(store, { newsEnabled: true, proxyEnabled: true, facebookEnabled: true });
  news.configure();
  news.snapshot();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(requests, 0);
  news.close();
  fb.cancel();
});
