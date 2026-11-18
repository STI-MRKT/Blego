const { test } = require('node:test');
const assert = require('node:assert/strict');

test('TZ21 decoder is an isolated BLEGO route with local input and escaped output', async () => {
  const { state } = await import('../../src/js/state.js');
  const { appHTML } = await import('../../src/js/ui/shell.js');
  const { viewHTML } = await import('../../src/js/ui/views.js');
  const oldView = state.view;
  const previous = state.decoder;
  try {
    state.view = 'decoder';
    state.decoder = {
      input: '<script>unsafe</script>',
      format: 'auto',
      status: 'success',
      output: '{"result":"<svg onload=alert(1)>"}',
      json: true,
      layers: 1,
      detected: ['base64'],
      embedded: false,
      fragments: 0
    };
    const html = appHTML();
    assert.match(html, /data-view="decoder"/);
    assert.match(html, /Декодер строк/);
    assert.match(html, /id="decoder-input"/);
    assert.match(html, /id="decoder-format"/);
    assert.match(html, /data-action="decoder-decode"/);
    assert.match(html, /data-action="decoder-copy"/);
    assert.match(html, /data-action="decoder-clear"/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<script>unsafe<\/script>/);
    assert.doesNotMatch(html, /<svg onload=/);
    assert.ok(viewHTML().includes('Формат'));
    for (const protectedView of ['import', 'news', 'photos', 'checker']) {
      state.view = protectedView;
      assert.doesNotMatch(viewHTML(), /id="decoder-input"/);
    }
  } finally {
    state.view = oldView;
    state.decoder = previous;
  }
});
