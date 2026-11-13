const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

const PING_TARGETS = [
  { label: 'Cloudflare', host: '1.1.1.1', port: 443 },
  { label: 'Google DNS', host: '8.8.8.8', port: 53 },
  { label: 'Quad9', host: '9.9.9.9', port: 443 },
  { label: 'Cloudflare Speed', host: 'speed.cloudflare.com', port: 443 }
];

const IP_FIELDS =
  'status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query';
const IP_API = `http://ip-api.com/json/?fields=${IP_FIELDS}`;

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function networkInfo() {
  const interfaces = [];
  const nets = os.networkInterfaces();
  for (const [name, list] of Object.entries(nets)) {
    for (const entry of list || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const mac = entry.mac ? `${entry.mac.split(':').slice(0, 3).join(':')}:••:••:••` : '—';
      interfaces.push({ name, address: entry.address, mac });
    }
  }
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    uptime: Math.round(os.uptime()),
    interfaces
  };
}

async function ipInfo() {
  const response = await fetch(IP_API, {
    signal: AbortSignal.timeout(7000),
    headers: { 'user-agent': 'BLEGO' }
  });
  const data = await response.json();
  if (!data || data.status !== 'success')
    throw new Error(data && data.message ? data.message : 'IP lookup failed');
  return data;
}

function pingHost(host, port, timeoutMs = 2500, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const started = performance.now();
    const socket = net.connect({ host, port });
    let settled = false;
    const abort = () => {
      finish(null);
      reject(signal.reason);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) reject(signal.reason);
      else resolve(value);
    };
    signal?.addEventListener('abort', abort, { once: true });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(Math.round(performance.now() - started)));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}
function latencySummary(values) {
  const good = values.filter(Number.isFinite);
  const best = good.length ? Math.min(...good) : null;
  const worst = good.length ? Math.max(...good) : null;
  return {
    best,
    worst,
    avg: good.length ? Math.round(good.reduce((a, b) => a + b, 0) / good.length) : null,
    jitter: good.length > 1 ? worst - best : null
  };
}
async function pingAll(signal) {
  const values = await Promise.all(PING_TARGETS.map((t) => pingHost(t.host, t.port, 2500, signal)));
  return {
    targets: PING_TARGETS.map((t, i) => ({ ...t, ms: values[i] })),
    ...latencySummary(values),
    method: 'TCP connection latency',
    route: 'direct',
    checkedAt: new Date().toISOString()
  };
}
async function speedTest({ signal, fetchImpl = fetch } = {}) {
  const combined = AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]);
  combined.throwIfAborted();
  const started = performance.now(),
    maxBytes = 10000000;
  const response = await fetchImpl('https://speed.cloudflare.com/__down?bytes=10000000', {
    signal: combined,
    redirect: 'error',
    headers: { 'user-agent': 'BLEGO/1.3' },
    cache: 'no-store'
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Error('SPEED_REQUEST_FAILED');
  }
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw Error('RESPONSE_TOO_LARGE');
  }
  let firstByte = null,
    bytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      combined.throwIfAborted();
      const { done, value } = await require('./features/facebook/transport.cjs').withAbort(
        reader.read(),
        combined
      );
      if (done) break;
      if (firstByte === null) firstByte = performance.now();
      bytes += value.length;
      if (bytes > maxBytes) throw Error('RESPONSE_TOO_LARGE');
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  combined.throwIfAborted();
  if (!bytes || firstByte === null) throw Error('EMPTY_RESPONSE');
  const ended = performance.now(),
    ttfb = firstByte - started,
    total = ended - started;
  return {
    mbps: Number(((bytes * 8) / Math.max(1, total) / 1000).toFixed(1)),
    ms: Math.round(total),
    ttfb: Math.round(ttfb),
    bytes,
    route: 'direct',
    method: 'HTTPS download including connection and first byte',
    checkedAt: new Date().toISOString()
  };
}

async function handleApi(request, response, url) {
  const controller = new AbortController();
  response.once('close', () => {
    if (!response.writableEnded) controller.abort();
  });
  try {
    if (url.pathname === '/api/net/info') return sendJson(response, networkInfo());
    if (url.pathname === '/api/net/ip') return sendJson(response, await ipInfo());
    if (url.pathname === '/api/net/ping')
      return sendJson(response, await pingAll(controller.signal));
    if (url.pathname === '/api/net/speed')
      return sendJson(response, await speedTest({ signal: controller.signal }));
    if (url.pathname === '/api/fb/check')
      return sendJson(response, { error: 'USE_DESKTOP_PROFILE_DIAGNOSTICS' }, 410);
    return sendJson(response, { error: 'Not found' }, 404);
  } catch (error) {
    return sendJson(response, { error: 'REQUEST_FAILED' }, 502);
  }
}

function startServer(rootDir, port = 0, options = {}) {
  const root = path.resolve(rootDir);
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405);
        response.end();
        return;
      }
      const expected = `127.0.0.1:${server.address().port}`;
      if (
        request.headers.host !== expected ||
        (request.headers.origin && request.headers.origin !== `http://${expected}`)
      ) {
        response.writeHead(403);
        response.end();
        return;
      }
      let url;
      try {
        url = new URL(request.url || '/', `http://${expected}`);
        decodeURIComponent(url.pathname);
      } catch {
        response.writeHead(400);
        response.end();
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname.startsWith('/api/net/') && !options.networkEnabled?.()) {
          sendJson(response, { error: 'MODULE_DISABLED' }, 403);
          return;
        }
        handleApi(request, response, url);
        return;
      }
      let pathname = '/';
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch (error) {
        void error;
      }
      if (pathname === '/') pathname = '/index.html';
      const selectedRoot = pathname.startsWith('/shared/') ? path.join(root, '../shared') : root;
      if (pathname.startsWith('/shared/')) pathname = pathname.slice('/shared'.length);
      const filePath = path.resolve(selectedRoot, '.' + pathname);
      if (!filePath.startsWith(path.resolve(selectedRoot) + path.sep)) {
        response.writeHead(403);
        response.end('forbidden');
        return;
      }
      fs.readFile(filePath, (error, buffer) => {
        if (error) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('not found');
          return;
        }
        response.writeHead(200, {
          'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store'
        });
        response.end(buffer);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

module.exports = { startServer, speedTest, latencySummary, pingAll };

if (require.main === module) {
  const root = process.argv[2] || path.join(__dirname, '..', 'src');
  const port = Number(process.env.PORT || 4173);
  startServer(root, port)
    .then(({ url }) => {
      console.log(`BLEGO running at ${url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
