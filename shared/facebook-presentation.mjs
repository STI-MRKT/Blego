// Legacy direct-page logic is preserved only in archive/blego-facebook-direct-legacy-20261117.
export function facebookPresentation(result) {
  if (result?.availability === 'cancelled')
    return { status: 'CANCELLED', tone: '', description: 'Проверка отменена.' };
  if (result?.source === 'fbtools' && result?.parserVersion === 'fbtools-ndjson-v1') {
    if (result.reasonCode === 'FBTOOLS_VALID')
      return {
        status: 'LIVE',
        tone: 'ok',
        description: 'По данным check.fb.tools профиль активен (сторонняя проверка).'
      };
    if (result.reasonCode === 'FBTOOLS_NOEXIST')
      return {
        status: 'DIE',
        tone: 'err',
        description: 'check.fb.tools не нашёл профиль. Это не доказательство блокировки.'
      };
  }
  return { status: 'UNKNOWN', tone: '', description: 'Источник не подтвердил состояние профиля.' };
}
