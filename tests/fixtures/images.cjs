const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const sharp = require('sharp');
const run = promisify(execFile);
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
    const runtime = path.resolve('build/metadata-runtime/linux-x64');
    await run(
      path.join(runtime, 'bin/perl'),
      [
        path.resolve('resources/metadata/perl-bootstrap.pl'),
        require('exiftool-vendored.pl'),
        '-config',
        '',
        '-overwrite_original',
        '-n',
        '-XMP-dc:Title=Исходный заголовок',
        '-EXIF:Artist=Example Author',
        '-XMP-dc:Creator=Example Author',
        '-EXIF:GPSLatitude=12.5',
        '-EXIF:GPSLatitudeRef=N',
        '-EXIF:GPSLongitude=45.25',
        '-EXIF:GPSLongitudeRef=E',
        '-XMP-exif:GPSLatitude=12.5',
        '-XMP-exif:GPSLongitude=45.25',
        '--',
        file
      ],
      {
        env: {
          ...process.env,
          BLEGO_PERL_LIBS: [path.join(runtime, 'lib/core'), path.join(runtime, 'lib/arch')].join(
            '\x1f'
          )
        }
      }
    );
  }
  return file;
}
module.exports = { imageFixture };
