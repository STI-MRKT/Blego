const { getSettings, updateSettings } = require('../../local/settings.cjs');
const { checkProxy } = require('./service.cjs');
function createConsentedProxyChecker({ store, prompt, ...deps }) {
  let pending = null;
  async function consent() {
    const existing = getSettings(store).proxyReputationConsent;
    if (typeof existing === 'boolean') return existing;
    if (!pending)
      pending = (async () => {
        const granted = (await prompt()) === true;
        updateSettings(store, { proxyReputationConsent: granted });
        return granted;
      })().finally(() => {
        pending = null;
      });
    return pending;
  }
  return async (request, signal) => {
    if (signal?.aborted) throw Error('CANCELLED');
    const reputation = await consent();
    if (signal?.aborted) throw Error('CANCELLED');
    return checkProxy({ ...request, reputation }, signal, {
      ...deps,
      providers: reputation ? deps.providers : []
    });
  };
}
module.exports = { createConsentedProxyChecker };
