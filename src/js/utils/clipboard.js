import { I } from '../icons.js';
import { t } from '../i18n.js';
import { toast } from './toast.js';
import { checkCopyText } from '../../../shared/copy-format.mjs';

export async function copyText(text, button, successMessage) {
  try {
    text = text == null ? '' : String(text);
    checkCopyText(text);
    if (window.blego) {
      const result = await window.blego.copyText(String(text));
      if (!result.ok) throw Error(result.code);
    } else if (navigator.clipboard && window.isSecureContext)
      await navigator.clipboard.writeText(String(text));
    else {
      const focused = document.activeElement;
      const selection = window.getSelection(),
        ranges = [];
      for (let i = 0; i < (selection?.rangeCount || 0); i++)
        ranges.push(selection.getRangeAt(i).cloneRange());
      const area = document.createElement('textarea');
      area.value = String(text);
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } finally {
        area.remove();
        focused?.focus({ preventScroll: true });
        selection?.removeAllRanges();
        for (const range of ranges) selection?.addRange(range);
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
    toast(successMessage || t('Скопировано', 'Copied'));
    return { ok: true };
  } catch (error) {
    toast(
      error.code === 'COPY_TOO_LARGE' || error.message === 'COPY_TOO_LARGE'
        ? t(
            'Больше 10 МиБ. Используйте экспорт файла.',
            'Larger than 10 MiB. Export a file instead.'
          )
        : t(
            'Не удалось скопировать. Выделите текст вручную.',
            'Copy failed. Select the text manually.'
          ),
      'err'
    );
    return { ok: false, code: error.code || error.message || 'CLIPBOARD_FAILED' };
  }
}
