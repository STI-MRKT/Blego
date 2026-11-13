const fs = require('node:fs').promises;
const path = require('node:path');
const https = require('node:https');
const net = require('node:net');
const { resolvePublic } = require('../../local/network-safety.cjs');
const LIMIT = 512 * 1024,
  TTL = 7 * 86400000,
  MAX_CACHE = 128 * 1024 * 1024;
async function requestTile(url, { signal, headers }) {
  const ip = await resolvePublic(new URL(url).hostname, signal);
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        signal,
        headers,
        agent: false,
        lookup(_host, options, cb) {
          options.all
            ? cb(null, [{ address: ip, family: net.isIP(ip) }])
            : cb(null, ip, net.isIP(ip));
        }
      },
      (res) => {
        if (
          res.statusCode !== 200 ||
          !String(res.headers['content-type']).startsWith('image/png')
        ) {
          res.destroy();
          reject(Error('MAP_UNAVAILABLE'));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > LIMIT) {
            req.destroy(Error('MAP_TOO_LARGE'));
          } else chunks.push(chunk);
        });
        res.on('error', reject);
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
  });
}
async function validateImage(body) {
  if (
    !Buffer.isBuffer(body) ||
    body.length > LIMIT ||
    !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw Error('INVALID_MAP_IMAGE');
  const decoder = require('sharp')(body, { limitInputPixels: 256 * 256 });
  const metadata = await decoder.metadata();
  if (metadata.width !== 256 || metadata.height !== 256) throw Error('INVALID_MAP_IMAGE');
  // Metadata alone accepts truncated PNGs. Decode the bounded raster as well.
  await decoder.raw().toBuffer();
}
function createTileService({ root, request = requestTile, clock = () => Date.now() }) {
  const directory = path.join(root, 'map-tiles');
  const pending = new Map();
  let backoff = 0;
  async function tile(arg) {
    if (
      !arg ||
      typeof arg !== 'object' ||
      Object.keys(arg).sort().join(',') !== 'x,y,z' ||
      ![arg.z, arg.x, arg.y].every(Number.isInteger) ||
      arg.z < 0 ||
      arg.z > 19 ||
      arg.x < 0 ||
      arg.y < 0 ||
      arg.x >= 2 ** arg.z ||
      arg.y >= 2 ** arg.z
    )
      throw Error('INVALID_TILE');
    const key = `${arg.z}-${arg.x}-${arg.y}.png`,
      file = path.join(directory, key);
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 4) throw Error('MAP_BUSY');
    const job = (async () => {
      try {
        const stat = await fs.lstat(file);
        if (
          stat.isFile() &&
          !stat.isSymbolicLink() &&
          stat.size <= LIMIT &&
          clock() - stat.mtimeMs < TTL
        ) {
          const body = await fs.readFile(file);
          try {
            await validateImage(body);
            return 'data:image/png;base64,' + body.toString('base64');
          } catch {
            await fs.unlink(file);
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw Error('MAP_CACHE_UNAVAILABLE');
      }
      if (clock() < backoff) throw Error('MAP_UNAVAILABLE');
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      // No eviction of fresh tiles: keep the provider's seven-day minimum and
      // refuse new downloads when the bounded cache is full.
      let bytes = 0;
      for (const name of await fs.readdir(directory))
        if (/^\d+-\d+-\d+\.png$/.test(name)) {
          const candidate = path.join(directory, name);
          try {
            const stat = await fs.lstat(candidate);
            if (stat.isFile() && !stat.isSymbolicLink()) {
              if (clock() - stat.mtimeMs >= TTL) await fs.unlink(candidate);
              else bytes += stat.size;
            }
          } catch (error) {
            // Another visible tile job may already have removed this stale entry.
            if (error.code !== 'ENOENT') throw error;
          }
        }
      if (bytes + LIMIT > MAX_CACHE) throw Error('MAP_CACHE_FULL');
      let body;
      try {
        body = await request(`https://tile.openstreetmap.org/${arg.z}/${arg.x}/${arg.y}.png`, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent': 'BLEGO/1.4.1 (+https://github.com/STI-MRKT/Blego)',
            Accept: 'image/png'
          }
        });
      } catch {
        backoff = clock() + 60000;
        throw Error('MAP_UNAVAILABLE');
      }
      await validateImage(body);
      try {
        await fs.writeFile(file, body, { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if (error.code !== 'EEXIST') throw Error('MAP_CACHE_UNAVAILABLE');
      }
      return 'data:image/png;base64,' + body.toString('base64');
    })();
    pending.set(key, job);
    try {
      return await job;
    } finally {
      pending.delete(key);
    }
  }
  return { tile };
}
module.exports = { createTileService };
