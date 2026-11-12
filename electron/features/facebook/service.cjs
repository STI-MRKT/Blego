const { setTimeout: sleep } = require('node:timers/promises');
const { normalizeTarget } = require('./normalize.cjs');
const { inspectResponse, PARSER_VERSION } = require('./inspect.cjs');
const { fetchPublicProfile, withAbort } = require('./transport.cjs');
function createFacebookService({
  store,
  transport = fetchPublicProfile,
  clock = { now: Date.now, sleep: (ms, signal) => sleep(ms, undefined, { signal }) }
} = {}) {
  let active = null,
    lastStart = -Infinity;
  function base(target, runId, availability, reasonCode) {
    return {
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
      let paused = false;
      try {
        for (const target of clean) {
          if (active !== controller) return;
          if (controller.signal.aborted) {
            yield base(target, runId, 'cancelled', 'CANCELLED');
            continue;
          }
          if (paused) {
            yield base(target, runId, 'unknown', 'QUEUE_PAUSED');
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
            paused = ['request_limited', 'challenge_required'].includes(result.availability);
          } catch (error) {
            result = base(
              target,
              runId,
              controller.signal.aborted ? 'cancelled' : 'network_error',
              controller.signal.aborted
                ? 'CANCELLED'
                : /^FB_[A-Z_]+$/.test(error.message)
                  ? error.message
                  : 'NETWORK_FAILURE'
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
