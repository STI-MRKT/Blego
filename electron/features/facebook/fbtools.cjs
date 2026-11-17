'use strict';

const { normalizeTarget } = require('./normalize.cjs');

const ENDPOINT = 'https://check.fb.tools/api/check/facebook';
const PARSER_VERSION = 'fbtools-ndjson-v1';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_LINE_CHARS = 64 * 1024;

const OUTCOMES = Object.freeze({
  valid: ['profile_visible', 'FBTOOLS_VALID'],
  noexist: ['unavailable', 'FBTOOLS_NOEXIST'],
  invalid: ['unknown', 'FBTOOLS_RESTRICTED'],
  verify: ['unknown', 'FBTOOLS_VERIFY'],
  error: ['unknown', 'FBTOOLS_PROVIDER_ERROR']
});

function reason(error, signal, combinedSignal) {
  if (signal?.aborted) return 'CANCELLED';
  if (combinedSignal?.aborted) return 'FBTOOLS_TIMEOUT';
  if (error?.message === 'FBTOOLS_RESPONSE_TOO_LARGE') return 'FBTOOLS_RESPONSE_TOO_LARGE';
  if (error?.message === 'FBTOOLS_INVALID_STREAM') return 'FBTOOLS_INVALID_STREAM';
  return 'FBTOOLS_NETWORK_ERROR';
}

function resultFor(target, runId, availability, reasonCode, { now, start, httpStatus } = {}) {
  return {
    status: availability === 'profile_visible' ? 'AVAILABLE' : 'UNKNOWN',
    source: 'fbtools',
    attempted: reasonCode !== 'CANCELLED',
    target: target.target,
    canonicalUrl: target.canonicalUrl,
    availability,
    publicContent:
      availability === 'profile_visible'
        ? 'available'
        : availability === 'unavailable'
          ? 'unavailable'
          : null,
    reasonCode,
    banAssessment: 'unknown',
    profileName: null,
    avatarUrl: null,
    objectType: null,
    checkedAt: reasonCode === 'CANCELLED' ? null : new Date(now()).toISOString(),
    durationMs: Math.max(0, now() - start),
    httpStatus,
    parserVersion: PARSER_VERSION,
    runId,
    evidenceSummary: 'Unverified third-party classification'
  };
}

async function* readEvents(response) {
  if (!response.body || typeof response.body.getReader !== 'function')
    throw Error('FBTOOLS_INVALID_STREAM');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let bytes = 0;

  function parse(line) {
    try {
      return JSON.parse(line);
    } catch {
      throw Error('FBTOOLS_INVALID_STREAM');
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw Error('FBTOOLS_INVALID_STREAM');
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw Error('FBTOOLS_RESPONSE_TOO_LARGE');
      buffer += decoder.decode(value, { stream: true });
      let pos;
      while ((pos = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, pos).trim();
        buffer = buffer.slice(pos + 1);
        if (line.length > MAX_LINE_CHARS) throw Error('FBTOOLS_RESPONSE_TOO_LARGE');
        if (line) yield parse(line);
      }
      if (buffer.length > MAX_LINE_CHARS) throw Error('FBTOOLS_RESPONSE_TOO_LARGE');
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      if (buffer.length > MAX_LINE_CHARS) throw Error('FBTOOLS_RESPONSE_TOO_LARGE');
      yield parse(buffer.trim());
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Reader may already be closed or aborted.
    }
    reader.releaseLock();
  }
}

// Deliberately uses only a fixed HTTPS host. No cookies, auth headers,
// redirects, browser sessions, CAPTCHA solving, or rate-limit workarounds.
async function* checkFbTools({
  targets,
  runId,
  signal,
  fetchImpl = globalThis.fetch,
  now = Date.now
}) {
  if (
    !Array.isArray(targets) ||
    targets.length > 100 ||
    typeof runId !== 'string' ||
    !runId ||
    runId.length > 100
  )
    throw Error('FB_INPUT_INVALID');

  const normalized = targets.map((item) => normalizeTarget(item.canonicalUrl));
  const start = now();
  const completed = new Set();
  const deadline = AbortSignal.timeout(60000);
  const combinedSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let failure = 'FBTOOLS_INCOMPLETE';
  let httpStatus = null;

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/x-ndjson'
      },
      body: JSON.stringify({
        inputData: normalized.map((item) => item.canonicalUrl),
        userLang: 'en',
        checkFriends: false
      }),
      signal: combinedSignal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    });
    httpStatus = response.status;

    if (!response.ok) {
      failure = response.status === 429 ? 'FBTOOLS_RATE_LIMITED' : 'FBTOOLS_HTTP_ERROR';
    } else if (
      !String(response.headers?.get?.('content-type') || '')
        .toLowerCase()
        .includes('application/x-ndjson')
    ) {
      failure = 'FBTOOLS_INVALID_FORMAT';
    } else {
      for await (const event of readEvents(response)) {
        if (event?.event === 'error') {
          failure = 'FBTOOLS_PROVIDER_ERROR';
          break;
        }
        if (event?.event !== 'result') continue;
        const data = event.data;
        const position = data?.id;
        if (
          !Number.isInteger(position) ||
          position < 1 ||
          position > normalized.length ||
          completed.has(position)
        )
          continue;
        const target = normalized[position - 1];
        let matches = false;
        try {
          matches = normalizeTarget(data.origin).canonicalUrl === target.canonicalUrl;
        } catch {
          // Reject unrecognized/mismatched provider identity.
        }
        const outcome = matches && OUTCOMES[data?.status?.name];
        const availability = outcome ? outcome[0] : 'unknown';
        const code = outcome ? outcome[1] : 'FBTOOLS_TARGET_MISMATCH';
        completed.add(position);
        yield resultFor(target, runId, availability, code, { now, start, httpStatus });
      }
    }
  } catch (error) {
    failure = reason(error, signal, combinedSignal);
  }

  for (let index = 0; index < normalized.length; index += 1) {
    if (completed.has(index + 1)) continue;
    yield resultFor(
      normalized[index],
      runId,
      failure === 'CANCELLED' ? 'cancelled' : 'unknown',
      failure,
      { now, start, httpStatus }
    );
  }
}

module.exports = { checkFbTools, readEvents, ENDPOINT, PARSER_VERSION };
