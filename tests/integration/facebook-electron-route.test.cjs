const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
test('TZ11 Electron route uses isolated public DNS, anonymous manual redirects and decoded bounded HTML', async () => {
  const {
    createElectronPublicTransport
  } = require('../../electron/features/facebook/transport.cjs');
  const calls = [];
  let redirect = false,
    large = false;
  const session = { resolveHost: async () => ({ endpoints: [{ address: '1.1.1.1' }] }) };
  const requestFactory = (options) => {
    const request = new EventEmitter();
    const headers = {};
    calls.push({ options, headers });
    request.setHeader = (k, v) => {
      headers[k] = v;
    };
    request.abort = () => {};
    request.end = () =>
      queueMicrotask(() => {
        if (redirect) {
          request.emit('redirect', 302, 'GET', 'https://localhost/');
          return;
        }
        const response = Readable.from([
          Buffer.from(large ? 'x'.repeat(3000) : '<html><body>public</body></html>')
        ]);
        response.headers = {
          'content-type': ['text/html; charset=utf-8'],
          'content-encoding': ['gzip']
        };
        response.statusCode = 200;
        request.emit('response', response);
      });
    return request;
  };
  const transport = createElectronPublicTransport(session, { requestFactory });
  const result = await transport('https://www.facebook.com/NASA');
  assert.equal(result.status, 200);
  assert.match(result.body, /public/);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.useSessionCookies, false);
  assert.ok(!calls[0].headers.Cookie);
  assert.ok(!calls[0].headers.Authorization);
  await assert.rejects(transport('https://localhost/'), /FB_UNSAFE_URL/);
  session.resolveHost = async () => ({ endpoints: [{ address: '127.0.0.1' }] });
  await assert.rejects(transport('https://www.facebook.com/NASA'), /FB_PRIVATE_ADDRESS/);
  assert.equal(calls.length, 1);
  session.resolveHost = async () => ({ endpoints: [{ address: '1.1.1.1' }] });
  redirect = true;
  await assert.rejects(transport('https://www.facebook.com/NASA'), /FB_UNSAFE_URL/);
  redirect = false;
  large = true;
  await assert.rejects(
    transport('https://www.facebook.com/NASA', { maxBytes: 100 }),
    /FB_RESPONSE_TOO_LARGE/
  );
  await assert.rejects(transport('https://www.facebook.com/NASA', { signal: AbortSignal.abort() }));
});
