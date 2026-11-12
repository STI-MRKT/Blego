const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPublicAddress, resolvePublic } = require('../../electron/local/network-safety.cjs');
test('network endpoint policy rejects service, documentation and IPv4-mapped local ranges', async () => {
  for (const ip of [
    '0.0.0.0',
    '10.2.3.4',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.4.1',
    '192.168.0.1',
    '192.0.2.2',
    '198.51.100.1',
    '203.0.113.2',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
    '2001:db8::1'
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
    await assert.rejects(resolvePublic(ip), /REQUEST_BLOCKED/);
  }
  for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])
    assert.equal(isPublicAddress(ip), true);
});
