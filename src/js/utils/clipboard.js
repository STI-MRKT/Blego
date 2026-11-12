import { I } from '../icons.js';
import { t } from '../i18n.js';
import { toast } from './toast.js';

export async function copyText(text, button) {
  try {
    if (window.blego) {
      const result = await window.blego.copyText(String(text));
      if (!result.ok) throw Error(result.code);
    } else if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(String(text));
    else {
      const area = document.createElement('textarea');
      area.value = String(text);
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } finally {
        area.remove();
      }
      if (!ok) throw Error('CLIPBOARD_FAILED');
    }
    if (button) {
      const previous = button.innerHTML;
      button.innerHTML = I.check;
      setTimeout(() => {
        button.innerHTML = previous;
      }, 1300);
    }
    toast(t('Скопировано', 'Copied'));
    return { ok: true };
  } catch {
    toast(
      t(
        'Не удалось скопировать. Выделите текст вручную.',
        'Copy failed. Select the text manually.'
      ),
      'err'
    );
    return { ok: false };
  }
}
