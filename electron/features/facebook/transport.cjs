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
        let stream = response;
        const encoding = response.headers['content-encoding'];
        if (encoding === 'gzip') stream = response.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = response.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = response.pipe(zlib.createBrotliDecompress());
        else if (encoding && encoding !== 'identity') {
          response.destroy();
          return reject(Error('FB_UNSUPPORTED_ENCODING'));
        }
        const chunks = [];
        let bytes = 0;
        stream.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            stream.destroy();
            response.destroy();
            request.destroy();
            reject(Error('FB_RESPONSE_TOO_LARGE'));
          } else chunks.push(chunk);
        });
        stream.on('error', reject);
        response.on('error', reject);
        stream.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8')
          })
        );
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
module.exports = { fetchPublicProfile, isPublicAddress, withAbort };
