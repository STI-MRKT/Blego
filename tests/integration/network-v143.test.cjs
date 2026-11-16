const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { fixture } = require('../fixtures/archive.cjs');
test('TZ11 persisted Trust consent gates provider calls, ignores renderer flag and sends only exit IP', async (t) => {
  const { createConsentedProxyChecker } = require('../../electron/features/proxy/consent.cjs');
  const { getSettings, updateSettings } = require('../../electron/local/settings.cjs');
  const f = await fixture(t);
  let prompts = 0,
    lookups = 0;
  const deps = {
    store: f.store,
    prompt: async () => {
      prompts++;
      return false;
    },
    ipLookup: async () => ({ ip: '1.1.1.1', timings: { ipRequestMs: 20 } }),
    providers: [
      {
        id: 'proxycheck.io',
        lookup: async (ip) => {
          assert.equal(ip, '1.1.1.1');
          lookups++;
          return { ip, risk: 25, scale: [0, 100], proxy: false, hosting: false };
        }
      }
    ]
  };
  let check = createConsentedProxyChecker(deps);
  let result = await check({
    value: 'http://user:SYNTHETIC@public.example:8080',
    reputation: true
  });
  assert.equal(result.connection, 'ok');
  assert.equal(result.assessment.score, null);
  assert.equal(prompts, 1);
  assert.equal(lookups, 0);
  assert.equal(getSettings(f.store).proxyReputationConsent, false);
  check = createConsentedProxyChecker({
    ...deps,
    prompt: async () => {
      throw Error('MUST_NOT_PROMPT');
    }
  });
  await check({ value: '', reputation: true });
  assert.equal(lookups, 0);
  updateSettings(f.store, { proxyReputationConsent: true });
  result = await check({ value: 'http://user:SYNTHETIC@public.example:8080', reputation: false });
  assert.equal(result.assessment.score, 75);
  assert.equal(lookups, 1);
  assert.ok(result.quality.score > 0);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC|public.example/);
  const failed = createConsentedProxyChecker({
    ...deps,
    providers: [
      {
        id: 'proxycheck.io',
        lookup: async () => {
          throw Error('offline');
        }
      }
    ]
  });
  result = await failed({ value: '' });
  assert.equal(result.connection, 'ok');
  assert.equal(result.assessment.score, null);
  assert.throws(() => updateSettings(f.store, { proxyReputationConsent: 'yes' }));
  const signal = AbortSignal.abort();
  await assert.rejects(check({ value: '' }, signal), /CANCELLED/);
});
