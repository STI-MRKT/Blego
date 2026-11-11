import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { t } from '../i18n.js';

export function cellHTML(value, options = {}) {
  const text = String(value ?? '');
  if (!text) return '<td class="muted">—</td>';
  return `<td><div class="cell-box"><span class="cell-val${options.strong ? ' cell-strong' : ''}" data-action="cell-expand" title="${esc(text)}">${esc(text)}</span><button class="copy tiny" data-action="copy" data-copy="${esc(text)}" aria-label="${t('Копировать', 'Copy')}" title="${t('Копировать', 'Copy')}">${I.copy}</button></div></td>`;
}
