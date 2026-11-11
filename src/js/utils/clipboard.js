import { I } from '../icons.js';
import { t } from '../i18n.js';
import { toast } from './toast.js';

export function copyText(text, button) {
  const done = () => {
    if (button) {
      const previous = button.innerHTML;
      button.classList.add('copied');
      button.innerHTML = I.check;
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = previous;
      }, 1300);
    }
    toast(t('Скопировано', 'Copied'));
  };
  const fallback = () => {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch (error) {
      void error;
    }
    area.remove();
    done();
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(fallback);
  } else {
    fallback();
  }
}
