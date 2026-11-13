const net = require('node:net');
const dns = require('node:dns').promises;
const blocked = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['192.0.2.0', 24],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
])
  blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['2001:db8::', 32],
  ['2001::', 32],
  ['2002::', 16],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
])
  blocked.addSubnet(address, prefix, 'ipv6');
function isPublicAddress(address) {
  const version = net.isIP(address);
  return !!version && !blocked.check(address, version === 4 ? 'ipv4' : 'ipv6');
}
async function resolvePublic(host, signal) {
  host = host.replace(/^\[|\]$/g, '');
  signal?.throwIfAborted();
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw Error('REQUEST_BLOCKED');
    return host;
  }
  if (host === 'localhost' || /\.(?:localhost|local|internal)$/.test(host))
    throw Error('REQUEST_BLOCKED');
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw Error('DNS_FAILED');
  }
  signal?.throwIfAborted();
  if (!addresses.length || addresses.some((r) => !isPublicAddress(r.address)))
    throw Error('REQUEST_BLOCKED');
  return addresses[0].address;
}
module.exports = { isPublicAddress, resolvePublic };
