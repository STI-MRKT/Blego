const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseProxy } = require('../../electron/features/proxy/transports.cjs');
const { assess } = require('../../electron/features/proxy/assessment.cjs');
test('explicit proxy protocols, authentication and direct mode', () => {
  assert.equal(parseProxy(''), null);
  assert.equal(parseProxy('localhost:8080').protocol, 'http:');
  for (const p of ['http', 'https', 'socks5'])
    assert.equal(parseProxy(`${p}://user:pass@localhost:1080`).protocol, p + ':');
  for (const p of ['ftp://host:10', 'javascript:x', 'host:99999', 'http://host:80/path'])
    assert.throws(() => parseProxy(p));
});
test('missing reputation stays unknown and latency is not a risk input', () => {
  assert.equal(assess([{ status: 'not_configured' }]).score, null);
  const sources = [{ status: 'ok', proxy: true, hosting: false }];
  assert.deepEqual(assess(sources, 1), assess(sources, 9999));
  assert.equal(assess(sources).score, null);
});
test('secret vault never falls back to plaintext', () => {
  const { secretVault } = require('../../electron/local/secrets.cjs');
  let wrote = false;
  const vault = secretVault(
    {
      set() {
        wrote = true;
      }
    },
    { isEncryptionAvailable: () => false }
  );
  assert.throws(() => vault.set('provider', 'fixture'), /SECURE_STORAGE_UNAVAILABLE/);
  assert.equal(wrote, false);
});
