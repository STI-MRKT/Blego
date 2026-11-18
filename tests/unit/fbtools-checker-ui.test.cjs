const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Checker uses only FB.Tools and renders LIVE, copy and privacy notice', async () => {
  const { state } = await import('../../src/js/state.js');
  const { checkerHTML } = await import('../../src/js/ui/checker.js');
  const prior = state.checker;
  try {
    state.checker = { input: '4', rows: null, checking: null };
    const baseline = checkerHTML();
    assert.match(baseline, /Источник: check.fb.tools/);
    assert.doesNotMatch(baseline, /id="checker-provider"/);
    assert.doesNotMatch(baseline, /Прямая проверка/);
    assert.match(baseline, /Ссылки передаются сервису check.fb.tools/);

    state.checker = {
      input: '4',
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
    const result = checkerHTML();
    assert.match(result, /data-checker-status="LIVE"/);
    assert.match(result, /data-action="checker-copy-results"/);
    assert.doesNotMatch(result, /id="checker-provider"/);
    for (const hidden of [
      'Повторить эту цель',
      '<summary>Подробности</summary>',
      'По данным check.fb.tools'
    ]) {
      assert.ok(!result.includes(hidden), hidden);
    }
    assert.match(result, /checker-status-icon/);
    assert.doesNotMatch(result, /Copy uncertainty reason/);
  } finally {
    state.checker = prior;
  }
});
