const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { normalizeTarget } = require('../../electron/features/facebook/normalize.cjs');
const { inspectResponse } = require('../../electron/features/facebook/inspect.cjs');
const target = normalizeTarget('123');
const body = (id = '123') =>
  `<link rel="canonical" href="${target.canonicalUrl}"><meta property="og:type" content="profile"><script type="application/ld+json">{"@type":"Person","url":"${target.canonicalUrl}","identifier":"${id}","name":"Synthetic Person","image":"https://scontent.example.fbcdn.net/synthetic.jpg"}</script>`;
test('Facebook facts require identity-bound public evidence and explicit eight-state vocabulary', () => {
  const visible = inspectResponse(target, { status: 200, body: body() });
  assert.equal(visible.status, 'PROFILE_VISIBLE');
  assert.equal(visible.profileName, 'Synthetic Person');
  assert.equal(visible.objectType, 'Person');
  assert.match(visible.avatarUrl, /fbcdn.net/);
  assert.equal(visible.source, 'public_page');
  const wrong = inspectResponse(target, { status: 200, body: body('456') });
  assert.equal(wrong.status, 'UNKNOWN');
  assert.equal(wrong.profileName, null);
  assert.equal(wrong.avatarUrl, null);
  for (const [status, html, expected] of [
    [403, '', 'UNKNOWN'],
    [401, '', 'LOGIN_REQUIRED'],
    [200, '<form action="/checkpoint/">', 'CHALLENGE_REQUIRED'],
    [429, '', 'RATE_LIMITED'],
    [200, '<meta property="og:title" content="Someone">', 'UNKNOWN']
  ]) {
    const r = inspectResponse(target, { status, body: html });
    assert.equal(r.status, expected);
    assert.equal(r.banAssessment, 'unknown');
    assert.equal(r.profileName, null);
  }
});
test('network failures have sanitized differentiated diagnostics, never raw messages', () => {
  const {
    networkReason,
    retryAfterUntil
  } = require('../../electron/features/facebook/diagnostics.cjs');
  for (const [code, expected] of [
    ['ENOTFOUND', 'FB_DNS_ERROR'],
    ['ECONNREFUSED', 'FB_CONNECTION_REFUSED'],
    ['CERT_HAS_EXPIRED', 'FB_TLS_ERROR'],
    ['ETIMEDOUT', 'FB_TIMEOUT'],
    ['ECONNRESET', 'FB_CONNECTION_RESET']
  ])
    assert.equal(networkReason({ code, message: 'FAKE_SECRET' }), expected);
  assert.equal(networkReason({ name: 'TimeoutError' }), 'FB_TIMEOUT');
  assert.equal(retryAfterUntil('120', 1000), 121000);
  assert.equal(retryAfterUntil(new Date(121000).toUTCString(), 1000), 121000);
  assert.equal(retryAfterUntil('invalid', 1000), 61000);
});
