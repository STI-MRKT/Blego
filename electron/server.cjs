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

async function fbCheck(id) {
  const value = String(id || '').trim();
  if (!/^[a-z0-9._-]{3,50}$/i.test(value)) throw new Error('Invalid ID');
  const target = `https://www.facebook.com/${encodeURIComponent(value)}`;
  const started = performance.now();
  const response = await fetch(target, {
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-GB,en;q=0.9'
    }
  });
  const html = await response.text();
  const ms = Math.round(performance.now() - started);
  const finalUrl = response.url || target;
  const titleRaw = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const title = decodeEntities(titleRaw).replace(/\s+/g, ' ').trim().slice(0, 140);
  const unavailable =
    /(content isn't available|content isn’t available|this page isn't available|this page isn’t available|link you followed may be broken|may have been removed|page not found)/i.test(
      html
    );
  const login = /\/login|checkpoint/i.test(finalUrl) || /log in|log into facebook/i.test(title);
  let status = 'unknown';
  if (response.status === 404) status = 'not_found';
  else if (unavailable) status = 'unavailable';
  else if (login) status = 'login';
  else if (response.ok && /property=["']og:title["']/i.test(html)) status = 'active';
  return { id: value, status, http: response.status, finalUrl, title, ms };
}

function pingHost(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(Math.round(performance.now() - started)));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}

async function pingAll() {
  const values = await Promise.all(
    PING_TARGETS.map((target) => pingHost(target.host, target.port))
  );
  const targets = PING_TARGETS.map((target, index) => ({
    label: target.label,
    host: target.host,
    ms: values[index]
  }));
  const good = targets.map((target) => target.ms).filter((value) => value !== null);
  const best = good.length ? Math.min(...good) : null;
  const worst = good.length ? Math.max(...good) : null;
  return {
    targets,
    best,
    worst,
    avg: good.length ? Math.round(good.reduce((sum, value) => sum + value, 0) / good.length) : null,
    jitter: good.length > 1 ? worst - best : 0
  };
}

async function speedTest() {
  const started = performance.now();
  const response = await fetch('https://speed.cloudflare.com/__down?bytes=10000000', {
    signal: AbortSignal.timeout(25000),
    headers: { 'user-agent': 'BLEGO' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Speed test failed');
  const ttfb = Math.round(performance.now() - started);
  const buffer = await response.arrayBuffer();
  const total = performance.now() - started;
  const transfer = Math.max(1, total - ttfb);
  const mbps = (buffer.byteLength * 8) / (transfer / 1000) / 1e6;
  return { mbps: Number(mbps.toFixed(1)), ms: Math.round(total), ttfb, bytes: buffer.byteLength };
}

async function handleApi(request, response, url) {
  try {
    if (url.pathname === '/api/net/info') return sendJson(response, networkInfo());
    if (url.pathname === '/api/net/ip') return sendJson(response, await ipInfo());
    if (url.pathname === '/api/net/ping') return sendJson(response, await pingAll());
    if (url.pathname === '/api/net/speed') return sendJson(response, await speedTest());
    if (url.pathname === '/api/fb/check')
      return sendJson(response, await fbCheck(url.searchParams.get('id')));
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

module.exports = { startServer };

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
