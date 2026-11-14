// Raw diagnostic statuses remain available in history. Only current, explicit
// public-content evidence may produce either of the two decisive UI outcomes.
export function facebookPresentation(result) {
  const current = result?.parserVersion === 'public-evidence-v4' && result.source === 'public_page';
  if (current && result.publicContent === 'available' && result.availability === 'profile_visible')
    return { status: 'ACTIVE', tone: 'ok', description: 'Публичный контент доступен' };
  if (current && result.publicContent === 'unavailable' && result.availability === 'unavailable')
    return { status: 'BLOCKED', tone: 'err', description: 'Публичный контент недоступен' };
  const statuses = {
    login_required: 'LOGIN_REQUIRED',
    challenge_required: 'CHALLENGE_REQUIRED',
    request_limited: 'RATE_LIMITED',
    network_error: 'NETWORK_ERROR',
    cancelled: 'CANCELLED'
  };
  return {
    status: statuses[result?.availability] || 'UNKNOWN',
    tone: '',
    description: ['profile_visible', 'unavailable'].includes(result?.availability)
      ? 'Результат требует повторной проверки.'
      : ''
  };
}
