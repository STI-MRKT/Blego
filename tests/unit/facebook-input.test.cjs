const { test } = require('node:test');
const assert = require('node:assert/strict');
test('long IDs retain exact digits; canonical duplicates preserve input mappings', () => {
  const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');
  const out = normalizeFacebookTargets(
    '0012345678901234567890123\nhttps://m.facebook.com/profile.php?id=0012345678901234567890123&ref=x\nhttps://facebook.com/people/Name/12345\nAlice.Test'
  );
  assert.equal(out.targets.length, 3);
  assert.equal(out.targets[0].target, '0012345678901234567890123');
  assert.equal(
    out.targets[0].canonicalUrl,
    'https://www.facebook.com/profile.php?id=0012345678901234567890123'
  );
  assert.equal(out.inputRows.length, 4);
  assert.equal(out.duplicateMappings.length, 1);
});
test('spoofed hosts, credentials, reserved paths, invalid IDs and overlarge batches reject locally', () => {
  const { normalizeFacebookTargets } = require('../../electron/features/facebook/normalize.cjs');
  for (const input of [
    'https://facebook.com.evil.test/a',
    'https://evilfacebook.com/a',
    'https://x:y@facebook.com/a',
    'https://facebook.com:444/a',
    'https://127.0.0.1/a',
    'https://fb.me/a',
    'https://facebook.com/groups',
    'https://facebook.com/LOGIN',
    'https://facebook.com/share/abc',
    '000',
    '1'.repeat(33),
    'https://facebook.com/profile.php?id=123&id=456',
    'https://face\nbook.com/a'
  ])
    assert.ok(normalizeFacebookTargets(input).errors.length, input);
  assert.throws(() => normalizeFacebookTargets(Array(101).fill('alice').join('\n')), {
    message: 'FB_TOO_MANY_ROWS'
  });
});
