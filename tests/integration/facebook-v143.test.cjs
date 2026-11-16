const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const { readHtmlResponse } = require('../../electron/features/facebook/transport.cjs');
async function response(headers, body, limit = 4096) {
  const server = http.createServer((_q, res) => {
    res.writeHead(200, headers);
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${server.address().port}`, (res) => {
        Promise.resolve()
          .then(() => readHtmlResponse(res, { maxBytes: limit }))
          .then(resolve, reject);
      });
      req.on('error', reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test('TZ11 actual HTTP streams decode supported compression/charset and reject invalid HTML transport', async () => {
  const html = '<html><body><h1>Café public</h1></body></html>';
  for (const [encoding, pack] of [
    ['gzip', zlib.gzipSync],
    ['deflate', zlib.deflateSync],
    ['br', zlib.brotliCompressSync]
  ]) {
    const r = await response(
      { 'content-type': 'text/html; charset=windows-1252', 'content-encoding': encoding },
      pack(Buffer.from(html, 'latin1'))
    );
    assert.equal(r.body, html);
    assert.equal(r.diagnostics.charset, 'windows-1252');
  }
  await assert.rejects(
    response({ 'content-type': 'application/json' }, '{}'),
    /FB_UNEXPECTED_CONTENT_TYPE/
  );
  await assert.rejects(
    response({ 'content-encoding': 'gzip' }, Buffer.from('bad gzip')),
    /FB_DECOMPRESSION_ERROR/
  );
  await assert.rejects(
    response({ 'content-encoding': 'gzip' }, zlib.gzipSync(Buffer.from('x'.repeat(5000)))),
    /FB_RESPONSE_TOO_LARGE/
  );
  await assert.rejects(
    response({ 'content-type': 'text/html; charset=invalid-charset' }, '<html></html>'),
    /FB_UNSUPPORTED_CHARSET/
  );
});
