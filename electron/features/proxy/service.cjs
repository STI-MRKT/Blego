const { parseProxy, ipLookup: transport, safeTransportError } = require('./transports.cjs');
const { lookupProviders } = require('./providers.cjs');
const { assess } = require('./assessment.cjs');
async function checkProxy(request, cancellation, deps = {}) {
  const proxy = parseProxy(request?.value);
  if (cancellation?.aborted) throw Error('CANCELLED');
  const total = AbortSignal.any([
    AbortSignal.timeout(deps.timeoutMs || 30000),
    ...(cancellation ? [cancellation] : [])
  ]);
  const start = performance.now();
  let result;
  try {
    result = await (deps.ipLookup || transport)(proxy, {
      target: deps.target,
      ca: deps.ca,
      resolveEndpoint: deps.resolveEndpoint,
      signal: AbortSignal.any([total, AbortSignal.timeout(10000)])
    });
  } catch (e) {
    if (cancellation?.aborted) throw Error('CANCELLED');
    return {
      connection: 'failed',
      exitIp: null,
      code: [
        'RATE_LIMITED',
        'INVALID_RESPONSE',
        'HTTP_ERROR',
        'AUTH_FAILED',
        'REQUEST_BLOCKED',
        'TLS_FAILED',
        'DNS_FAILED',
        'CONNECTION_REFUSED',
        'TIMEOUT',
        'RESPONSE_TOO_LARGE'
      ].includes(e.message)
        ? e.message
        : safeTransportError(e, total),
      timings: {
        connectionMs: null,
        ipRequestMs: null,
        reputationMs: 0,
        totalMs: performance.now() - start
      },
      sources: [],
      assessment: assess([]),
      checkedAt: new Date().toISOString()
    };
  }
  const repStart = performance.now();
  const sources = await lookupProviders(result.ip, deps.providers || [], total);
  if (cancellation?.aborted) throw Error('CANCELLED');
  if (total.aborted) throw Error('TIMEOUT');
  return {
    connection: 'ok',
    mode: proxy ? 'proxy' : 'direct',
    protocol: proxy?.protocol || 'direct',
    exitIp: result.ip,
    ipSource: deps.target || 'https://api64.ipify.org?format=json',
    timings: {
      ...result.timings,
      reputationMs: performance.now() - repStart,
      totalMs: performance.now() - start
    },
    sources,
    assessment: assess(sources, result.ip),
    checkedAt: new Date().toISOString()
  };
}
module.exports = { checkProxy };
