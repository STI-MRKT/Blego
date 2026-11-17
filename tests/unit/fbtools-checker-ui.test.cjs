const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Checker renders selectable FB.Tools provider and third-party statuses without changing direct mode', async () => {
  const { state } = await import('../../src/js/state.js');
  const { checkerHTML } = await import('../../src/js/ui/checker.js');
  const prior = state.checker;
  try {
    state.checker = {
      input: '4',
      rows: null,
      provider: 'direct',
      checking: null
    };
    const baseline = checkerHTML();
    assert.match(baseline, /id="checker-provider"/);
    assert.match(baseline, /Прямая проверка<\/option>/);
    assert.doesNotMatch(baseline, /Ссылки передаются стороннему сервису/);

    state.checker = {
      input: '4',
      provider: 'fbtools',
      checking: null,
      checkedInput: '4',
      rows: [
        {
          id: '4',
          input: '4',
          link: 'https://www.facebook.com/profile.php?id=4',
          check: {
            source: 'fbtools',
            parserVersion: 'fbtools-ndjson-v1',
            reasonCode: 'FBTOOLS_VALID',
            availability: 'profile_visible',
            checkedAt: new Date().toISOString()
          }
        }
      ]
    };
    const output = checkerHTML();
    assert.match(output, /check\.fb\.tools/);
    assert.match(output, /data-checker-status="LIVE"/);
    assert.match(output, /data-action="checker-copy-results"/);
    assert.match(output, /Ссылки передаются стороннему сервису/);
  } finally {
    state.checker = prior;
  }
});
