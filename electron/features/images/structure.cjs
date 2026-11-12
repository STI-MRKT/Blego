const { createHash } = require('node:crypto');
const { crc32 } = require('node:zlib');
const sharp = require('sharp');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
function inspectStructure(bytes) {
  if (bytes.length > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
  const protectedParts = [];
  let format,
    signed = false;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    format = 'png';
    let pos = 8,
      ended = false;
    while (pos < bytes.length) {
      if (pos + 12 > bytes.length) throw Error('IMAGE_CORRUPT');
      const size = bytes.readUInt32BE(pos),
        end = pos + 12 + size;
      if (end > bytes.length) throw Error('IMAGE_CORRUPT');
      const type = bytes.toString('ascii', pos + 4, pos + 8);
      if (crc32(bytes.subarray(pos + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
        throw Error('IMAGE_CORRUPT');
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw Error('ANIMATED_IMAGE_UNSUPPORTED');
      if (type === 'caBX') signed = true;
      if (
        ['IHDR', 'IDAT', 'PLTE', 'tRNS', 'iCCP', 'sRGB', 'gAMA', 'cHRM', 'cICP', 'sBIT'].includes(
          type
        )
      )
        protectedParts.push(bytes.subarray(pos, end));
      pos = end;
      if (type === 'IEND') {
        ended = true;
        break;
      }
    }
    if (!ended || pos !== bytes.length) throw Error('IMAGE_CORRUPT');
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    format = 'jpeg';
    let pos = 2,
      sos = false;
    if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw Error('IMAGE_CORRUPT');
    while (pos < bytes.length - 2) {
      if (bytes[pos] !== 255) throw Error('IMAGE_CORRUPT');
      const marker = bytes[pos + 1];
      if (pos + 4 > bytes.length) throw Error('IMAGE_CORRUPT');
      const length = bytes.readUInt16BE(pos + 2),
        end = pos + 2 + length;
      if (length < 2 || end > bytes.length) throw Error('IMAGE_CORRUPT');
      if (marker === 218) {
        protectedParts.push(bytes.subarray(pos));
        sos = true;
        break;
      }
      if (marker === 235 && bytes.subarray(pos, end).includes(Buffer.from('c2pa'))) signed = true;
      if (marker !== 225 && marker !== 237 && marker !== 254)
        protectedParts.push(bytes.subarray(pos, end));
      pos = end;
    }
    if (!sos) throw Error('IMAGE_CORRUPT');
  } else if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    format = 'webp';
    if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw Error('IMAGE_CORRUPT');
    let pos = 12;
    while (pos < bytes.length) {
      if (pos + 8 > bytes.length) throw Error('IMAGE_CORRUPT');
      const type = bytes.toString('ascii', pos, pos + 4),
        size = bytes.readUInt32LE(pos + 4),
        end = pos + 8 + size + (size % 2);
      if (end > bytes.length) throw Error('IMAGE_CORRUPT');
      if (['ANIM', 'ANMF'].includes(type) || (type === 'VP8X' && bytes[pos + 8] & 2))
        throw Error('ANIMATED_IMAGE_UNSUPPORTED');
      if (type === 'JUMB') signed = true;
      if (!['EXIF', 'XMP ', 'VP8X'].includes(type)) protectedParts.push(bytes.subarray(pos, end));
      pos = end;
    }
  } else throw Error('METADATA_UNSUPPORTED');
  if (!protectedParts.length) throw Error('IMAGE_CORRUPT');
  return {
    format,
    signed,
    protectedHash: createHash('sha256').update(Buffer.concat(protectedParts)).digest('hex')
  };
}
async function decodeHash(file) {
  const input = sharp(file, {
    limitInputPixels: IMAGE_LIMITS.pixels,
    failOn: 'warning',
    sequentialRead: true
  });
  const info = await input.metadata();
  if ((info.pages || 1) > 1) throw Error('ANIMATED_IMAGE_UNSUPPORTED');
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of input.rotate().ensureAlpha().raw()) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return {
    width: info.width,
    height: info.height,
    orientation: info.orientation || 1,
    hasAlpha: info.hasAlpha,
    decodedBytes: bytes,
    decodedHash: hash.digest('hex')
  };
}
module.exports = { inspectStructure, decodeHash };
