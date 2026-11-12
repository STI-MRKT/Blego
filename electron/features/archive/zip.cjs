const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const yazl = require('yazl');
const yauzl = require('yauzl');
const { crc32 } = require('node:zlib');
const { validEntryName, validateManifest } = require('./manifest.cjs');
async function writeZip(file, entries, signal) {
  const z = new yazl.ZipFile();
  for (const [name, bytes] of Object.entries(entries)) z.addBuffer(bytes, name);
  const stream = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 });
  const done = pipeline(z.outputStream, stream, ...(signal ? [{ signal }] : []));
  z.end();
  await done;
  const handle = await fs.promises.open(file, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function readZip(
  file,
  {
    maxBytes = 256 * 1024 * 1024,
    maxFiles = 2000,
    maxDepth = Infinity,
    validateContents = validateManifest
  } = {}
) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(file) && !fs.lstatSync(file).isFile())
      return reject(Error('INVALID_ARCHIVE_FILE'));
    const open = Buffer.isBuffer(file) ? yauzl.fromBuffer : yauzl.open;
    open(
      file,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, z) => {
        if (error) return reject(Error('INVALID_ZIP'));
        let count = 0,
          total = 0,
          settled = false;
        const entries = Object.create(null),
          names = new Set();
        const fail = () => {
          if (settled) return;
          settled = true;
          z.close();
          reject(Error('UNSAFE_OR_CORRUPT_ZIP'));
        };
        z.on('error', fail);
        z.on('entry', (e) => {
          const name = e.fileName,
            mode = (e.externalFileAttributes >>> 16) & 0xf000,
            normal = name.normalize('NFC').toLowerCase();
          if (
            ++count > maxFiles ||
            !validEntryName(name) ||
            name.split('/').length > maxDepth + 1 ||
            names.has(normal) ||
            mode === 0xa000 ||
            e.generalPurposeBitFlag & 1 ||
            total + e.uncompressedSize > maxBytes
          )
            return fail();
          names.add(normal);
          z.openReadStream(e, (error, stream) => {
            if (error) return fail();
            const chunks = [];
            let size = 0,
              crc = 0;
            stream.on('error', fail);
            stream.on('data', (b) => {
              size += b.length;
              total += b.length;
              if (total > maxBytes || size > e.uncompressedSize) {
                stream.destroy();
                fail();
                return;
              }
              crc = crc32(b, crc);
              chunks.push(b);
            });
            stream.on('end', () => {
              if (settled) return;
              if (size !== e.uncompressedSize || crc !== e.crc32) return fail();
              entries[name] = Buffer.concat(chunks);
              z.readEntry();
            });
          });
        });
        z.on('end', () => {
          if (settled) return;
          try {
            const m = JSON.parse(entries['manifest.json']?.toString() || 'null');
            validateContents(m, entries);
            settled = true;
            resolve({ manifest: m, entries });
          } catch {
            fail();
          }
        });
        z.readEntry();
      }
    );
  });
}
module.exports = { writeZip, readZip };
