const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
async function imageFixture(root, format = 'jpeg', { metadata = true, name } = {}) {
  const file = path.join(root, name || `synthetic.${format === 'jpeg' ? 'jpg' : format}`);
  const pixels = Buffer.alloc(12 * 8 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i * 7) % 255;
    pixels[i + 1] = (i * 11) % 255;
    pixels[i + 2] = 120;
    pixels[i + 3] = format === 'jpeg' ? 255 : i % 3 ? 180 : 255;
  }
  await sharp(pixels, { raw: { width: 12, height: 8, channels: 4 } })
    .withMetadata({ orientation: 6 })
    .toFormat(format)
    .toFile(file);
  if (metadata) {
    // Fixture preparation only: these files are synthetic, not originals submitted to the application.
    await require('../../electron/features/images/engine.cjs')
      .createEngine()
      .writeCopy(
        file,
        [
          { field: 'title', action: 'set', value: 'Исходный заголовок' },
          { field: 'author', action: 'set', value: 'Example Author' },
          {
            field: 'gps',
            action: 'set',
            value: { latitude: 12.5, longitude: 45.25, altitude: null }
          }
        ],
        format
      );
  }
  return file;
}
module.exports = { imageFixture };
module.exports.distinctCopies = function distinctCopies(file, count) {
  return Array.from({ length: count }, (_, index) => {
    const target = path.join(
      path.dirname(file),
      `${path.basename(file, path.extname(file))}-${index}${path.extname(file)}`
    );
    fs.copyFileSync(file, target);
    return target;
  });
};
