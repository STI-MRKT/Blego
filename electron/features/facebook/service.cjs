const { setTimeout: sleep } = require('node:timers/promises');
const { normalizeTarget } = require('./normalize.cjs');
const { inspectResponse, PARSER_VERSION } = require('./inspect.cjs');
const { STATUSES, networkReason, retryAfterUntil } = require('./diagnostics.cjs');
const { fetchPublicProfile, withAbort } = require('./transport.cjs');
function createFacebookService({
  store,
  transport = fetchPublicProfile,
  clock = { now: Date.now, sleep: (ms, signal) => sleep(ms, undefined, { signal }) }
} = {}) {
  let active = null,
    lastStart = -Infinity;
  let nextAllowedAt = Number(store?.get('facebook:retryAfterUntil')) || 0;
  function base(target, runId, availability, reasonCode) {
    return {
      status: STATUSES[availability] || 'UNKNOWN',
      source: 'public_request',
      attempted: true,
      profileName: null,
      avatarUrl: null,
      objectType: null,
      target: target.target,
      canonicalUrl: target.canonicalUrl,
      availability,
      reasonCode,
      banAssessment: 'unknown',
      checkedAt: new Date(clock.now()).toISOString(),
      durationMs: 0,
      parserVersion: PARSER_VERSION,
      runId,
      evidenceSummary: reasonCode
    };
  }
  return {
    cancel() {
      active?.abort();
    },
    async *check({ targets, runId }) {
      if (
        !Array.isArray(targets) ||
        targets.length > 100 ||
        typeof runId !== 'string' ||
        runId.length > 100
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
      let paused = null;
      try {
        for (const target of clean) {
          if (active !== controller) return;
          if (controller.signal.aborted) {
            yield {
              ...base(target, runId, 'cancelled', 'CANCELLED'),
              attempted: false,
              checkedAt: null,
              source: 'request_queue'
            };
            continue;
          }
          if (paused || nextAllowedAt > clock.now()) {
            const limited = nextAllowedAt > clock.now();
            yield {
              ...base(
                target,
                runId,
                limited ? 'request_limited' : 'unknown',
                paused ? 'QUEUE_PAUSED' : 'RETRY_AFTER'
              ),
              attempted: false,
              checkedAt: null,
              source: 'request_queue',
              retryAt: limited ? new Date(nextAllowedAt).toISOString() : null
            };
            continue;
          }
          const started = clock.now();
          let result;
          try {
            const delay = Math.max(0, 2000 - (clock.now() - lastStart));
            if (delay) await withAbort(clock.sleep(delay, controller.signal), controller.signal);
            controller.signal.throwIfAborted();
            lastStart = clock.now();
            const response = await withAbort(
              transport(target.canonicalUrl, { signal: controller.signal }),
              controller.signal
            );
            controller.signal.throwIfAborted();
            result = {
              ...base(target, runId, 'unknown', 'INSUFFICIENT_EVIDENCE'),
              ...inspectResponse(target, response),
              finalUrl: response.url,
              durationMs: clock.now() - started
            };
            paused = ['request_limited', 'challenge_required'].includes(result.availability)
              ? result.availability
              : null;
            if (result.availability === 'request_limited') {
              nextAllowedAt = retryAfterUntil(response.headers?.['retry-after'], clock.now());
              store?.set('facebook:retryAfterUntil', nextAllowedAt);
              result.retryAt = new Date(nextAllowedAt).toISOString();
            }
          } catch (error) {
            result = base(
              target,
              runId,
              controller.signal.aborted ? 'cancelled' : 'network_error',
              controller.signal.aborted ? 'CANCELLED' : networkReason(error)
            );
            result.durationMs = clock.now() - started;
          }
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
