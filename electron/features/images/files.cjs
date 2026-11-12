const fs = require('node:fs');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
async function readBounded(file) {
  const handle = await fs.promises.open(
    file,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
    const chunks = [];
    let size = 0;
    for await (const chunk of handle.createReadStream({
      autoClose: false,
      start: 0,
      end: IMAGE_LIMITS.fileBytes
    })) {
      size += chunk.length;
      if (size > IMAGE_LIMITS.fileBytes) throw Error('IMAGE_TOO_LARGE');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally {
    await handle.close();
  }
}
module.exports = { readBounded };
