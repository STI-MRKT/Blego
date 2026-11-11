import { t } from '../i18n.js';

const localeTag = () => 'en-GB';

export function fmtDate(timestamp) {
  return new Intl.DateTimeFormat(localeTag(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

export function fmtDay(timestamp) {
  return new Intl.DateTimeFormat(localeTag(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(timestamp));
}

export function rel(timestamp) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return t('только что', 'just now');
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return t(`${minutes} мин назад`, `${minutes} min ago`);
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return t(`${hours} ч назад`, `${hours} h ago`);
  }
  const days = Math.floor(seconds / 86400);
  if (days === 1) return t('вчера', 'yesterday');
  if (days < 30) return t(`${days} дн назад`, `${days} d ago`);
  return fmtDay(timestamp);
}
