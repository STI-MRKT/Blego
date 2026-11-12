const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startServer } = require('../../electron/server.cjs');
test('loopback serves the existing interface', async (t) => {
  const { server, url } = await startServer(path.resolve('src'));
  t.after(() => server.close());
  assert.equal(server.address().address, '127.0.0.1');
  const res = await fetch(url);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /BLEGO/);
  assert.equal((await fetch(url + 'api/fb/check?id=123')).status, 410);
});
test('invalid_url_does_not_exit and untrusted Host is rejected', async (t) => {
  const { server, url } = await startServer(path.resolve('src'));
  t.after(() => server.close());
  assert.equal((await fetch(url + '%ZZ')).status, 400);
  const badHost = await new Promise((resolve, reject) =>
    require('node:http')
      .get(url, { headers: { Host: 'evil.test' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on('error', reject)
  );
  assert.equal(badHost, 403);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(url)).status, 200);
});
