const {
  parseProxy,
  ipLookup: transport,
  tcpLatency,
  safeTransportError
} = require('./transports.cjs');
const { lookupProviders } = require('./providers.cjs');
const { assess, quality } = require('./assessment.cjs');
async function checkProxy(request, cancellation, deps = {}) {
  const proxy = parseProxy(request?.value);
  if (cancellation?.aborted) throw Error('CANCELLED');
  const total = AbortSignal.any([
    AbortSignal.timeout(45000),
    ...(cancellation ? [cancellation] : [])
  ]);
  const start = performance.now(),
    attempts = [];
  let result = null,
    code = null,
    tcpMs = null;
  const options = () => ({
    target: deps.target,
    ca: deps.ca,
    resolveEndpoint: deps.resolveEndpoint,
    signal: AbortSignal.any([total, AbortSignal.timeout(10000)])
  });
  if (!deps.ipLookup)
    try {
      tcpMs = await tcpLatency(proxy, options());
    } catch (e) {
      code = safeTransportError(e, total);
    }
  // Check is three small HTTPS echo requests, never a speed download.
  for (let i = 0; i < 3 && !total.aborted; i++) {
    try {
      const next = await (deps.ipLookup || transport)(proxy, options());
      result = next;
      attempts.push({ ms: next.timings.ipRequestMs, ip: next.ip });
    } catch (e) {
      if (cancellation?.aborted) throw Error('CANCELLED');
      code = ['RATE_LIMITED', 'INVALID_RESPONSE', 'HTTP_ERROR'].includes(e.message)
        ? e.message
        : safeTransportError(e, total);
      attempts.push({ ms: null, code });
      if (['AUTH_FAILED', 'REQUEST_BLOCKED', 'DNS_FAILED'].includes(code)) break;
    }
  }
  if (cancellation?.aborted) throw Error('CANCELLED');
  let speed = null,
    speedError = null;
  if (result && request.fullTest === true && !total.aborted) {
    try {
      speed = await (deps.speedLookup || transport)(proxy, {
        ...options(),
        target: deps.speedTarget || 'https://speed.cloudflare.com/__down?bytes=3000000',
        download: true
      });
    } catch (e) {
      speedError = safeTransportError(e, total);
    }
  }
  if (cancellation?.aborted) throw Error('CANCELLED');
  const repStart = performance.now();
  const sources =
    result && request.reputation === true && !total.aborted
      ? await lookupProviders(result.ip, deps.providers || [], total)
      : [{ id: 'reputation', status: request.reputation ? 'unavailable' : 'not_requested' }];
  if (cancellation?.aborted) throw Error('CANCELLED');
  return {
    connection: result ? 'ok' : 'failed',
    mode: proxy ? 'proxy' : 'direct',
    protocol: proxy?.protocol || 'direct',
    exitIp: result?.ip || null,
    code: result ? null : code || 'TIMEOUT',
    ipSource: deps.target || 'https://api64.ipify.org?format=json',
    timings: {
      connectionMs: null,
      ipRequestMs: null,
      ...result?.timings,
      tcpMs,
      reputationMs: performance.now() - repStart,
      totalMs: performance.now() - start
    },
    quality: quality(attempts),
    attempts,
    rotatingIp: new Set(attempts.map((a) => a.ip).filter(Boolean)).size > 1,
    speed,
    speedError,
    sources,
    assessment: assess(sources, result?.ip),
    checkedAt: new Date().toISOString()
  };
}
module.exports = { checkProxy };
