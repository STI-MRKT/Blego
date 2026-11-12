const { test } = require('node:test');
const assert = require('node:assert/strict');
test('existing supported country set remains available', async () => {
 const {LOCALES} = await import('../../src/js/data/locales.js');
 assert.deepEqual(Object.keys(LOCALES).sort(), ['BR','DE','ES','FR','GB','IT','PL','US']);
});
test('HTML escaping preserves text without executable tags', async () => {
 const {esc} = await import('../../src/js/utils/dom.js');
 assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
