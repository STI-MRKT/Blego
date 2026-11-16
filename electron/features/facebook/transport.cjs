const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const zlib = require('node:zlib');
const { HOSTS } = require('./normalize.cjs');
const { isPublicAddress } = require('../../local/network-safety.cjs');
function safeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Error('FB_UNSAFE_URL');
  }
  if (
    url.protocol !== 'https:' ||
    !HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error('FB_UNSAFE_URL');
  return url;
}
function readHtmlResponse(response, { maxBytes, signal } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false,
      stream = response,
      bytes = 0;
    const chunks = [];
    const fail = (code) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      stream.destroy();
      response.destroy();
      reject(code instanceof Error ? code : Error(code));
    };
    const abort = () => fail(signal.reason || Error('CANCELLED'));
    const type = String(response.headers['content-type'] || 'text/html');
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|\s*$)/i.test(type))
      return fail('FB_UNEXPECTED_CONTENT_TYPE');
    const encoding = String(response.headers['content-encoding'] || 'identity')
      .toLowerCase()
      .trim();
    if (encoding === 'gzip') stream = response.pipe(zlib.createGunzip());
    else if (encoding === 'deflate') stream = response.pipe(zlib.createInflate());
    else if (encoding === 'br') stream = response.pipe(zlib.createBrotliDecompress());
    else if (encoding !== 'identity') return fail('FB_UNSUPPORTED_ENCODING');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) return abort();
    response.on('aborted', () => fail('FB_INCOMPLETE_RESPONSE'));
    response.on('error', () => fail('FB_INCOMPLETE_RESPONSE'));
    stream.on('error', () =>
      fail(encoding === 'identity' ? 'FB_INCOMPLETE_RESPONSE' : 'FB_DECOMPRESSION_ERROR')
    );
    stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) fail('FB_RESPONSE_TOO_LARGE');
      else chunks.push(chunk);
    });
    stream.on('end', () => {
      if (settled) return;
      if (response.complete === false) return fail('FB_INCOMPLETE_RESPONSE');
      const data = Buffer.concat(chunks);
      const declared = /charset\s*=\s*["']?([a-z0-9_-]+)/i.exec(type)?.[1];
      const htmlDeclared = /<meta\b[^>]*charset\s*=\s*["']?([a-z0-9_-]+)/i.exec(
        data.subarray(0, 4096).toString('latin1')
      )?.[1];
      let decoder, body;
      try {
        decoder = new TextDecoder(declared || htmlDeclared || 'utf-8', { fatal: true });
      } catch {
        return fail('FB_UNSUPPORTED_CHARSET');
      }
      try {
        body = decoder.decode(data);
      } catch {
        return fail('FB_INVALID_TEXT_ENCODING');
      }
      settled = true;
      signal?.removeEventListener('abort', abort);
      resolve({
        status: response.statusCode,
        headers: response.headers,
        body,
        diagnostics: { encoding, charset: decoder.encoding, decodedBytes: bytes }
      });
    });
  });
}
function requestPage(url, { signal, maxBytes }) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        agent: false,
        signal,
        headers: {
          'User-Agent': 'BLEGO/1.4 public profile diagnostics',
          Accept: 'text/html',
          'Accept-Encoding': 'identity'
        },
        lookup(hostname, options, callback) {
          dns.lookup(hostname, { all: true }, (error, addresses) => {
            if (error) return callback(error);
            if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
              return callback(Error('FB_PRIVATE_ADDRESS'));
            if (options.all) callback(null, addresses);
            else callback(null, addresses[0].address, addresses[0].family);
          });
        }
      },
      (response) => {
        readHtmlResponse(response, { maxBytes, signal }).then(resolve, reject);
      }
    );
    request.on('error', reject);
  });
}
function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || Error('CANCELLED'));
    if (signal.aborted) {
      Promise.resolve(promise).catch(() => {});
      return abort();
    }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
async function fetchPublicProfile(
  raw,
  {
    signal,
    request = requestPage,
    maxBytes = 2 * 1024 * 1024,
    deadline = (ms) => AbortSignal.timeout(ms)
  } = {}
) {
  let url = safeUrl(raw);
  const timed = deadline(15000);
  const combined = signal ? AbortSignal.any([signal, timed]) : timed;
  for (let step = 0; step <= 5; step++) {
    combined.throwIfAborted();
    const result = await withAbort(request(url.href, { signal: combined, maxBytes }), combined);
    combined.throwIfAborted();
    if (Buffer.byteLength(result.body || '', 'utf8') > maxBytes)
      throw Error('FB_RESPONSE_TOO_LARGE');
    if ([301, 302, 303, 307, 308].includes(result.status) && result.headers?.location) {
      if (step === 5) throw Error('FB_TOO_MANY_REDIRECTS');
      url = safeUrl(new URL(result.headers.location, url).href);
      continue;
    }
    // Only sanitized profile/service paths are retained; no sensitive query is echoed.
    const final = new URL(url);
    for (const key of [...final.searchParams.keys()])
      if (key !== 'id') final.searchParams.delete(key);
    final.hash = '';
    return { ...result, url: final.href };
  }
  throw Error('FB_TOO_MANY_REDIRECTS');
}
// The isolated Chromium session follows the OS network configuration. It never
// reads the renderer session, login cookies or imported credentials.
function createElectronPublicTransport(session, { requestFactory } = {}) {
  requestFactory ||= (options) => require('electron').net.request(options);
  return (raw, options = {}) =>
    fetchPublicProfile(raw, {
      ...options,
      request: async (rawUrl, { signal, maxBytes }) => {
        const url = safeUrl(rawUrl);
        const resolved = await withAbort(session.resolveHost(url.hostname), signal);
        if (
          !resolved.endpoints?.length ||
          resolved.endpoints.some((item) => !isPublicAddress(item.address))
        )
          throw Error('FB_PRIVATE_ADDRESS');
        signal.throwIfAborted();
        return new Promise((resolve, reject) => {
          const request = requestFactory({
            url: url.href,
            session,
            method: 'GET',
            redirect: 'manual',
            useSessionCookies: false,
            credentials: 'omit'
          });
          let settled = false;
          const finish = (error, value) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            if (error) reject(error);
            else resolve(value);
          };
          const abort = () => {
            finish(signal.reason || Error('CANCELLED'));
            request.abort();
          };
          signal.addEventListener('abort', abort, { once: true });
          request.setHeader('Accept', 'text/html');
          request.setHeader('User-Agent', 'BLEGO/1.4 public profile diagnostics');
          request.on('login', (_info, callback) => callback());
          request.on('redirect', (status, _method, location) => {
            // Chromium fetch rejects manual redirects. ClientRequest exposes the
            // destination before following it, so the shared allowlist remains authoritative.
            finish(null, { status, headers: { location }, body: '' });
            request.abort();
          });
          request.on('response', (response) => {
            const headers = Object.fromEntries(
              Object.entries(response.headers).map(([k, v]) => [
                k.toLowerCase(),
                Array.isArray(v) ? v.join(', ') : v
              ])
            );
            // Chromium has already decompressed the stream.
            delete headers['content-encoding'];
            // IncomingMessage headers may be read-only; a PassThrough retains the
            // common byte/charset checks without mutating Chromium's object.
            const { PassThrough } = require('node:stream');
            const stream = new PassThrough();
            stream.headers = headers;
            stream.statusCode = response.statusCode;
            response.on('error', (error) => stream.destroy(error));
            response.on('aborted', () => stream.destroy(Error('FB_INCOMPLETE_RESPONSE')));
            stream.on('close', () => {
              if (!settled) request.abort();
            });
            readHtmlResponse(stream, { maxBytes, signal }).then(
              (value) => {
                value.diagnostics.transport = 'electron-session';
                finish(null, value);
              },
              (error) => {
                finish(error);
                request.abort();
              }
            );
            response.pipe(stream);
          });
          request.on('error', (error) => finish(error));
          if (signal.aborted) return abort();
          request.end();
        });
      }
    });
}
module.exports = {
  fetchPublicProfile,
  createElectronPublicTransport,
  isPublicAddress,
  withAbort,
  readHtmlResponse
};
