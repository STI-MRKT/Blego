const { test } = require('node:test');
const assert = require('node:assert/strict');
test('Photos always renders its map without a manual background load or hide control', async () => {
  const { state } = await import('../../src/js/state.js');
  const { photoMapHTML } = await import('../../src/js/ui/photo-map.js');
  state.photos = [];
  state.photoMap = { mode: 'before', background: false };
  const html = photoMapHTML();
  assert.match(html, /photo-map-canvas/);
  assert.doesNotMatch(html, /data-map-action="background"|Загрузить подложку|Скрыть подложку/);
  assert.match(html, /OpenStreetMap/);
});
