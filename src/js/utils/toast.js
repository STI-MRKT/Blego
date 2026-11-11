import { I } from '../icons.js';
import { esc } from './dom.js';

export function toast(message, kind) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const element = document.createElement('div');
  element.className = 'toast';
  element.innerHTML = `${kind === 'err' ? I.alert : I.check}<span>${esc(message)}</span>`;
  root.appendChild(element);
  setTimeout(() => {
    element.classList.add('out');
    setTimeout(() => element.remove(), 260);
  }, 2200);
}
