const { test } = require('node:test');
const assert = require('node:assert/strict');
test('public responses never establish account sanctions and one og:title proves nothing', () => {
  const { inspectResponse } = require('../../electron/features/facebook/inspect.cjs');
  const target = { target: '123', canonicalUrl: 'https://www.facebook.com/profile.php?id=123' };
  for (const [status, body, availability] of [
    [200, '<meta property="og:title" content="Jane">', 'unknown'],
    [200, '<form id="login_form" action="/login/">', 'login_required'],
    [200, '<form action="/checkpoint/">', 'challenge_required'],
    [200, 'You are temporarily blocked', 'request_limited'],
    [200, "<p>This content isn't available right now</p>", 'unavailable'],
    [429, '', 'request_limited'],
    [403, '', 'unknown'],
    [404, '', 'unknown'],
    [200, '<p>Незнакомая страница</p>', 'unknown']
  ]) {
    const result = inspectResponse(target, { status, body, url: target.canonicalUrl });
    assert.equal(result.availability, availability);
    assert.equal(result.banAssessment, 'unknown');
  }
  const body = `<link rel="canonical" href="${target.canonicalUrl}"><meta property="og:type" content="profile"><script type="application/ld+json">{"@type":"Person","url":"${target.canonicalUrl}","identifier":"123","name":"Synthetic Person"}</script>`;
  assert.equal(
    inspectResponse(target, { status: 200, body, url: target.canonicalUrl }).availability,
    'profile_visible'
  );
  assert.equal(
    inspectResponse(
      { ...target, target: '456', canonicalUrl: target.canonicalUrl.replace('123', '456') },
      { status: 200, body, url: target.canonicalUrl }
    ).availability,
    'unknown'
  );
});
