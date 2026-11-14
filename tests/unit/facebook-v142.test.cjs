const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectResponse } = require('../../electron/features/facebook/inspect.cjs');
const { normalizeTarget } = require('../../electron/features/facebook/normalize.cjs');
const target = normalizeTarget('123');
const profile = (id = '123', name = 'Synthetic Person') =>
  `<link rel="canonical" href="https://www.facebook.com/profile.php?id=${id}"><meta property="og:type" content="profile"><script type="application/ld+json">${JSON.stringify({ '@type': 'Person', url: `https://www.facebook.com/profile.php?id=${id}`, identifier: id, name })}</script>`;
test('TZ9 public evidence matrix never converts transport/login/other-profile responses to BLOCKED', () => {
  for (const [status, body, url, expected] of [
    [200, profile(), target.canonicalUrl, 'profile_visible'],
    [200, '<h1>Content isn’t available</h1>', target.canonicalUrl, 'unavailable'],
    [404, "<h1>This page isn't available.</h1>", target.canonicalUrl, 'unavailable'],
    [200, '<form id="login_form">', target.canonicalUrl, 'login_required'],
    [200, '<form action="/checkpoint/">', target.canonicalUrl, 'challenge_required'],
    [200, profile('456'), target.canonicalUrl, 'unknown'],
    [200, profile(), 'https://www.facebook.com/profile.php?id=456', 'unknown'],
    [403, '', target.canonicalUrl, 'unknown'],
    [404, '', target.canonicalUrl, 'unknown'],
    [410, '', target.canonicalUrl, 'unknown'],
    [429, '', target.canonicalUrl, 'request_limited'],
    [200, '', target.canonicalUrl, 'unknown'],
    [
      200,
      '<script>var phrase="Content isn\'t available";</script>',
      target.canonicalUrl,
      'unknown'
    ],
    [200, "<h1>Content isn't available</h1>", 'https://www.facebook.com/help/', 'unknown'],
    [200, profile('123', ''), target.canonicalUrl, 'unknown'],
    [200, '<html>' + profile(), target.canonicalUrl, 'unknown'],
    [200, '<!--' + profile() + '-->', target.canonicalUrl, 'unknown']
  ]) {
    const result = inspectResponse(target, { status, body, url });
    assert.equal(result.availability, expected, `HTTP${status}, expected ${expected}`);
    assert.equal(result.banAssessment, 'unknown');
  }
});
test('TZ9 ACTIVE/BLOCKED presentation is evidence-bound; legacy results require recheck', async () => {
  const { facebookPresentation } = await import('../../shared/facebook-presentation.mjs');
  const active = inspectResponse(target, { status: 200, body: profile() });
  const blocked = inspectResponse(target, {
    status: 200,
    body: "<h1>Content isn't available</h1>"
  });
  assert.equal(facebookPresentation(active).status, 'ACTIVE');
  assert.equal(facebookPresentation(blocked).status, 'BLOCKED');
  assert.equal(
    facebookPresentation({ ...blocked, parserVersion: 'public-evidence-v3' }).status,
    'UNKNOWN'
  );
  assert.equal(
    facebookPresentation({ availability: 'unavailable', reasonCode: 'HTTP_403' }).status,
    'UNKNOWN'
  );
  for (const availability of [
    'network_error',
    'login_required',
    'challenge_required',
    'request_limited',
    'cancelled',
    'unknown'
  ])
    assert.equal(facebookPresentation({ availability }).tone, '');
});
test('TZ9 hidden unavailable placeholders and contradictory Person evidence stay UNKNOWN', () => {
  for (const attr of [
    'hidden',
    'hidden="false"',
    'inert',
    'aria-hidden="true"',
    'style="display:none"',
    'style="visibility: hidden"',
    'style="opacity:0"',
    'style=display:none'
  ]) {
    const body = `<html><body><main>Loading public profile</main><div ${attr}><section><h1>Content isn’t available</h1></section></div></body></html>`;
    assert.equal(inspectResponse(target, { status: 200, body }).availability, 'unknown', attr);
  }
});
test('TZ9 contradictory structured target identity cannot establish BLOCKED or ACTIVE', () => {
  const wrong =
    '<script type="application/ld+json">{"@type":"Person","url":"https://www.facebook.com/profile.php?id=456","identifier":"456","name":"Another Synthetic Person"}</script>';
  assert.equal(
    inspectResponse(target, { status: 200, body: wrong + '<h1>Content isn’t available</h1>' })
      .availability,
    'unknown'
  );
  assert.equal(
    inspectResponse(target, {
      status: 200,
      body: profile() + '<link rel="canonical" href="https://www.facebook.com/profile.php?id=456">'
    }).availability,
    'unknown'
  );
});
