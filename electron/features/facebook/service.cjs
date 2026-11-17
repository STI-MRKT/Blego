const { normalizeTarget } = require('./normalize.cjs');
const { checkFbTools } = require('./fbtools.cjs');

function createFacebookService({ store, fbtools = checkFbTools, clock = { now: Date.now } } = {}) {
  let active = null;
  return {
    cancel() {
      active?.abort();
    },
    async *check({ targets, runId, provider = 'fbtools' } = {}) {
      if (
        !Array.isArray(targets) ||
        targets.length > 100 ||
        typeof runId !== 'string' ||
        !runId ||
        runId.length > 100 ||
        provider !== 'fbtools'
      )
        throw Error('FB_INPUT_INVALID');
      const clean = [
        ...new Map(
          targets.map((target) => {
            const parsed = normalizeTarget(target.canonicalUrl);
            return [parsed.canonicalUrl, parsed];
          })
        ).values()
      ];
      active?.abort();
      const controller = new AbortController();
      active = controller;
      try {
        for await (const result of fbtools({
          targets: clean,
          runId,
          signal: controller.signal,
          now: clock.now
        })) {
          if (active !== controller) return;
          yield result;
        }
      } finally {
        if (active === controller) active = null;
      }
    },
    importedFacts(targetKey) {
      const target = normalizeTarget(targetKey);
      return structuredClone(store?.get('facebook:importedFacts')?.[target.canonicalUrl] || null);
    },
    linkImportedFacts(input) {
      if (
        !store ||
        !input ||
        Object.keys(input).some(
          (k) => !['targetKey', 'name', 'avatarUrl', 'recordId'].includes(k)
        ) ||
        typeof input.name !== 'string' ||
        input.name.length > 300 ||
        typeof input.avatarUrl !== 'string' ||
        input.avatarUrl.length > 2048 ||
        typeof input.recordId !== 'string' ||
        input.recordId.length > 100
      )
        throw Error('FB_INPUT_INVALID');
      const target = normalizeTarget(input.targetKey);
      if (input.avatarUrl) {
        let u;
        try {
          u = new URL(input.avatarUrl);
        } catch {
          throw Error('FB_INPUT_INVALID');
        }
        if (u.protocol !== 'https:' || u.username || u.password) throw Error('FB_INPUT_INVALID');
      }
      const all = store.get('facebook:importedFacts') || {};
      if (!Object.hasOwn(all, target.canonicalUrl) && Object.keys(all).length >= 500)
        throw Error('FB_LOCAL_FACTS_LIMIT');
      const fact = {
        name: input.name,
        avatarUrl: input.avatarUrl,
        recordId: input.recordId,
        source: 'imported_file',
        verified: false,
        linkedAt: new Date(clock.now()).toISOString()
      };
      store.set('facebook:importedFacts', { ...all, [target.canonicalUrl]: fact });
      return structuredClone(fact);
    },
    notes(targetKey) {
      const target = normalizeTarget(targetKey);
      return store?.get(`facebook:notes:${target.canonicalUrl}`) || [];
    },
    saveManualNote({ targetKey, status, comment = '' }) {
      if (
        !store ||
        !['blocked', 'not_blocked', 'not_checked'].includes(status) ||
        typeof comment !== 'string' ||
        comment.length > 2000
      )
        throw Error('FB_INPUT_INVALID');
      const target = normalizeTarget(targetKey);
      const note = {
        status,
        comment,
        reportedAt: new Date(clock.now()).toISOString(),
        source: 'owner_report'
      };
      const key = `facebook:notes:${target.canonicalUrl}`;
      store.set(key, [...(store.get(key) || []), note]);
      return note;
    }
  };
}
module.exports = { createFacebookService };
