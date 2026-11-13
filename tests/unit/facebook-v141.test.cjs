const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { inspectResponse } = require('../../electron/features/facebook/inspect.cjs');
const { normalizeTarget } = require('../../electron/features/facebook/normalize.cjs');
const target = normalizeTarget('123');
test('TZ06 login.php and checkpoint root cannot become unknown or visible', () => {
  for (const [url, body, status] of [
    ['https://www.facebook.com/login.php', '', 'LOGIN_REQUIRED'],
    [
      target.canonicalUrl,
      '<form action="/login/device-based/regular/login/?login_attempt=1"><input name="email"><input name="pass" type="password"></form>',
      'LOGIN_REQUIRED'
    ],
    ['https://www.facebook.com/checkpoint', '', 'CHALLENGE_REQUIRED']
  ])
    assert.equal(inspectResponse(target, { status: 200, url, body }).status, status);
});
test('TZ06 bounded JSON-LD graph recognizes matching public Person but no unrelated entity', () => {
  const html = (id) =>
    `<link rel="canonical" href="${target.canonicalUrl}"><meta property="og:type" content="profile"><script type="application/ld+json">{"@graph":[{"@type":"Person","url":"${target.canonicalUrl}","identifier":"${id}","name":"Synthetic Person"}]}</script>`;
  assert.equal(
    inspectResponse(target, { status: 200, body: html('123') }).status,
    'PROFILE_VISIBLE'
  );
  assert.equal(inspectResponse(target, { status: 200, body: html('456') }).status, 'UNKNOWN');
});
