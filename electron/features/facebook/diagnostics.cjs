const STATUSES = {
  profile_visible: 'PROFILE_VISIBLE',
  unavailable: 'UNAVAILABLE',
  login_required: 'LOGIN_REQUIRED',
  challenge_required: 'CHALLENGE_REQUIRED',
  request_limited: 'RATE_LIMITED',
  network_error: 'NETWORK_ERROR',
  unknown: 'UNKNOWN',
  cancelled: 'CANCELLED'
};
function networkReason(error) {
  const raw =
    error?.code || error?.cause?.code || /net::(ERR_[A-Z_]+)/.exec(error?.message || '')?.[1] || '';
  const code =
    {
      ERR_NAME_NOT_RESOLVED: 'ENOTFOUND',
      ERR_CONNECTION_REFUSED: 'ECONNREFUSED',
      ERR_CONNECTION_RESET: 'ECONNRESET',
      ERR_CONNECTION_CLOSED: 'ECONNRESET',
      ERR_CONNECTION_TIMED_OUT: 'ETIMEDOUT',
      ERR_TIMED_OUT: 'ETIMEDOUT',
      ERR_INTERNET_DISCONNECTED: 'ENETDOWN',
      ERR_ADDRESS_UNREACHABLE: 'EHOSTUNREACH'
    }[raw] || raw;
  if (error?.name === 'TimeoutError' || ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code))
    return 'FB_TIMEOUT';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ENODATA'].includes(code)) return 'FB_DNS_ERROR';
  if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) return 'FB_TLS_ERROR';
  if (code === 'ECONNREFUSED') return 'FB_CONNECTION_REFUSED';
  if (['ECONNRESET', 'EPIPE'].includes(code)) return 'FB_CONNECTION_RESET';
  if (['ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN'].includes(code)) return 'FB_NETWORK_UNREACHABLE';
  return /^FB_[A-Z_]+$/.test(error?.message || '') ? error.message : 'NETWORK_FAILURE';
}
function retryAfterUntil(value, now) {
  if (typeof value !== 'string' || value.length > 100) return now + 60000;
  const s = value.trim();
  let until;
  if (/^\d+$/.test(s)) {
    const seconds = Number(s);
    until = Math.min(8640000000000000, now + seconds * 1000);
  } else until = Date.parse(s);
  return Number.isFinite(until) && until > now ? until : now + 60000;
}
module.exports = { STATUSES, networkReason, retryAfterUntil };
