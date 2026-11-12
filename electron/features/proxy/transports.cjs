const https = require('node:https');
const net = require('node:net');
const { resolvePublic } = require('../../local/network-safety.cjs');
const { withAbort } = require('../facebook/transport.cjs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
function parseProxy(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw Error('INVALID_PROXY');
  const s = raw.trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(s.includes('://') ? s : `http://${s}`);
    decodeURIComponent(u.username);
    decodeURIComponent(u.password);
  } catch {
    throw Error('INVALID_PROXY');
  }
  if (
    !['http:', 'https:', 'socks5:', 'socks5h:'].includes(u.protocol) ||
    !u.hostname ||
    (u.pathname !== '/' && u.pathname !== '') ||
    u.search ||
    u.hash ||
    Number(u.port) < 0 ||
    Number(u.port) > 65535 ||
    u.port === '0'
  )
    throw Error('INVALID_PROXY');
  return u;
}
function safeTransportError(error, signal) {
  if (signal?.aborted) return signal.reason?.name === 'TimeoutError' ? 'TIMEOUT' : 'CANCELLED';
  if (
    ['REQUEST_BLOCKED', 'DNS_FAILED', 'AUTH_FAILED', 'TIMEOUT', 'RESPONSE_TOO_LARGE'].includes(
      error?.message
    )
  )
    return error.message;
  if (/auth/i.test(error?.message || '')) return 'AUTH_FAILED';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(error?.code)) return 'DNS_FAILED';
  if (error?.code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (error?.code === 'ETIMEDOUT' || /timed out|timeout/i.test(error?.message || ''))
    return 'TIMEOUT';
  if (/CERT|TLS|SSL|SELF_SIGNED/.test(error?.code || '')) return 'TLS_FAILED';
  return 'TRANSPORT_FAILED';
}
async function ipLookup(
  proxy,
  {
    target = 'https://api64.ipify.org?format=json',
    signal = AbortSignal.timeout(10000),
    ca,
    resolveEndpoint = resolvePublic
  } = {}
) {
  const u = new URL(target);
  if (u.protocol !== 'https:') throw Error('HTTPS_REQUIRED');
  let agent;
  let pinnedTarget;
  if (proxy) {
    const pinned = new URL(proxy.href);
    const host = proxy.hostname.replace(/^\[|\]$/g, '');
    const address = await withAbort(resolveEndpoint(host, signal), signal);
    pinned.hostname = net.isIPv6(address) ? `[${address}]` : address;
    agent = proxy.protocol.startsWith('socks5')
      ? new SocksProxyAgent(pinned, { timeout: 10000 })
      : new HttpsProxyAgent(pinned, {
          ca,
          servername: net.isIP(host) ? undefined : host,
          timeout: 10000
        });
  } else pinnedTarget = await withAbort(resolveEndpoint(u.hostname, signal), signal);
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let connected = null;
    const req = https.get(
      u,
      {
        agent,
        ca,
        signal,
        ...(pinnedTarget
          ? {
              lookup: (host, options, cb) =>
                options.all
                  ? cb(null, [{ address: pinnedTarget, family: net.isIP(pinnedTarget) || 4 }])
                  : cb(null, pinnedTarget, net.isIP(pinnedTarget) || 4)
            }
          : {}),
        headers: { accept: 'application/json', 'user-agent': 'BLEGO/1.3' }
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(
            Error(
              res.statusCode === 407
                ? 'AUTH_FAILED'
                : res.statusCode === 429
                  ? 'RATE_LIMITED'
                  : [401, 403].includes(res.statusCode)
                    ? 'REQUEST_BLOCKED'
                    : 'HTTP_ERROR'
            )
          );
          return;
        }
        let bytes = 0;
        const chunks = [];
        res.on('data', (b) => {
          bytes += b.length;
          if (bytes > 65536) req.destroy(Error('RESPONSE_TOO_LARGE'));
          else chunks.push(b);
        });
        res.on('error', () => reject(Error('TRANSPORT_FAILED')));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks));
            if (!net.isIP(data.ip)) throw Error();
            resolve({
              ip: data.ip,
              timings: { connectionMs: connected, ipRequestMs: performance.now() - start }
            });
          } catch {
            reject(Error('INVALID_RESPONSE'));
          }
        });
      }
    );
    req.on('socket', (socket) => {
      if (socket.encrypted && socket.secureConnecting)
        socket.once('secureConnect', () => {
          connected = performance.now() - start;
        });
      else if (socket.connecting)
        socket.once('connect', () => {
          connected = performance.now() - start;
        });
      else connected = performance.now() - start;
    });
    req.on('error', (e) => reject(Error(safeTransportError(e, signal))));
    req.on('close', () => agent?.destroy());
  });
}
module.exports = { parseProxy, ipLookup, safeTransportError };
