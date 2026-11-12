const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {startServer} = require('../../electron/server.cjs');
test('loopback serves the existing interface', async t => {
 const {server,url}=await startServer(path.resolve('src')); t.after(()=>server.close());
 assert.equal(server.address().address,'127.0.0.1');
 const res=await fetch(url); assert.equal(res.status,200); assert.match(await res.text(),/BLEGO/);
});
