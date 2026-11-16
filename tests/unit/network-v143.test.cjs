const { test } = require('node:test'),
  assert = require('node:assert/strict');
test('TZ11 Network omits reputation checkbox without removing either quality gauge', async () => {
  const { state } = await import('../../src/js/state.js');
  state.settings.proxyEnabled = true;
  const { networkHTML } = await import('../../src/js/ui/network.js');
  const html = networkHTML();
  assert.doesNotMatch(html, /proxy-reputation|Check IP Trust: send/);
  assert.match(html, /Connection Quality/);
  assert.match(html, /IP Trust/);
  assert.match(html, /Check with Speed/);
});
