import { state } from '../state.js';

// Progressive enhancement: selects retain their values, appearance and change events.
// Only generator controls are enhanced; the native fallback works without this module.
const selector = '.ux-generator select[data-input], #bio-country, #bio-type, [data-bio-institution], #bio-city';
const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase();
let owner = null, popup = null, choices = [], active = -1, search = '', searchTime = 0;
const resizeObserver = new ResizeObserver(() => { if (owner) position(); });

export function closeGeneratorPicker() {
  if (owner) {
    owner.setAttribute('aria-expanded', 'false');
    owner.removeAttribute('aria-activedescendant');
    owner.removeAttribute('aria-controls');
  }
  resizeObserver.disconnect();
  popup?.remove();
  owner = popup = null;
  choices = []; active = -1;
}
function position() {
  if (!owner?.isConnected || owner.disabled) return closeGeneratorPicker();
  const rect = owner.getBoundingClientRect();
  const roomBelow = innerHeight - rect.bottom - 8, roomAbove = rect.top - 8;
  const above = roomBelow < 180 && roomAbove > roomBelow;
  const width = Math.min(rect.width, innerWidth - 16);
  popup.style.width = `${width}px`;
  popup.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
  popup.style.maxHeight = `${Math.max(48, Math.min(260, above ? roomAbove : roomBelow))}px`;
  popup.style.top = above ? 'auto' : `${rect.bottom + 4}px`;
  popup.style.bottom = above ? `${innerHeight - rect.top + 4}px` : 'auto';
}
function highlight(index) {
  active = Math.max(0, Math.min(index, choices.length - 1));
  popup.querySelectorAll('[role="option"]').forEach((item, i) => {
    item.classList.toggle('active', i === active);
    if (i === active) {
      owner.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}
function choose(index) {
  const choice = choices[index], input = owner;
  if (!choice || choice.disabled || !input?.isConnected || input.disabled) return;
  closeGeneratorPicker();
  input.value = choice.value;
  if (input.id === 'bio-city') input.dataset.pickerPostal = choice.postal;
  input.focus({ preventScroll: true });
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
function render(filter = false) {
  if (!owner?.isConnected) return closeGeneratorPicker();
  const city = owner.id === 'bio-city';
  choices = city
    ? state.bioCities.filter(row => !filter || normalize(`${row.city} ${row.region || ''} ${row.postalCode}`).includes(normalize(owner.value))).map(row => ({ value: row.city, postal: row.postalCode, label: [row.city, row.region, row.postalCode].filter(Boolean).join(' · ') }))
    : [...owner.options].map(option => ({ value: option.value, label: option.textContent, disabled: option.disabled }));
  popup.replaceChildren();
  choices.forEach((choice, index) => {
    const item = document.createElement('div');
    item.id = `generator-option-${index}`;
    item.setAttribute('role', 'option');
    const selected = choice.value === owner.value && (!city || choice.postal === (owner.dataset.pickerPostal || state.bioParamsEditor?.values.postalCode || state.bio?.parameters.postalCode));
    item.setAttribute('aria-selected', String(selected));
    if (choice.disabled) item.setAttribute('aria-disabled', 'true');
    item.textContent = choice.label;
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', () => choose(index));
    popup.append(item);
  });
  if (!choices.length) {
    const empty = document.createElement('div');
    empty.className = 'generator-picker-empty';
    empty.textContent = 'Нет совпадений — можно ввести город вручную';
    empty.setAttribute('role', 'status');
    popup.append(empty);
    owner.removeAttribute('aria-activedescendant');
  }
  position();
  const selected = [...popup.children].findIndex(item => item.getAttribute('aria-selected') === 'true');
  highlight(Math.max(0, selected));
}
function open(input, filter = false) {
  if (input.disabled) return;
  closeGeneratorPicker();
  owner = input;
  popup = document.createElement('div');
  popup.id = 'generator-picker-list';
  popup.className = 'generator-picker-list';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', input.getAttribute('aria-label') || input.labels?.[0]?.textContent || 'Выбор значения');
  document.body.append(popup);
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', popup.id);
  render(filter);
  resizeObserver.observe(input);
}
export function refreshGeneratorPicker() {
  if (owner?.id === 'bio-city') render(Boolean(owner.value));
}
document.addEventListener('pointerdown', event => {
  const input = event.target.closest(selector);
  if (input && !input.disabled) {
    if (input.tagName === 'SELECT') event.preventDefault();
    input.focus({ preventScroll: true });
    if (owner === input && input.tagName === 'SELECT') closeGeneratorPicker();
    else open(input);
  } else if (!popup?.contains(event.target)) closeGeneratorPicker();
}, true);
document.addEventListener('click', event => {
  if (event.target.matches(selector) && event.target.tagName === 'SELECT') event.preventDefault();
}, true);
document.addEventListener('input', event => {
  if (event.target.id !== 'bio-city') return;
  if (event.isTrusted) delete event.target.dataset.pickerPostal;
  // Programmatic input from a committed option should leave the menu closed.
  if (event.isTrusted) {
    if (owner !== event.target) open(event.target, true);
    else render(true);
  }
}, true);
document.addEventListener('keydown', event => {
  const input = event.target.closest(selector);
  if (!input || input.disabled) return;
  const key = event.key, city = input.id === 'bio-city';
  if (key === 'Tab' || key === 'Escape') {
    if (owner === input) {
      if (key === 'Escape') event.preventDefault();
      closeGeneratorPicker();
    }
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key) && !(city && key === ' ')) {
    event.preventDefault();
    if (owner !== input) { open(input, city && Boolean(input.value)); return; }
    if (key === 'Enter' || key === ' ') choose(active);
    else highlight(active + (key === 'ArrowDown' ? 1 : -1));
  } else if (!city && ['Home', 'End'].includes(key)) {
    event.preventDefault();
    if (owner !== input) open(input);
    highlight(key === 'Home' ? 0 : choices.length - 1);
  } else if (!city && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    search = Date.now() - searchTime > 700 ? key : search + key;
    searchTime = Date.now();
    if (owner !== input) open(input);
    const index = choices.findIndex(choice => normalize(choice.label).startsWith(normalize(search)));
    if (index >= 0) highlight(index);
  }
}, true);
document.addEventListener('focusin', event => { if (owner && event.target !== owner && !popup.contains(event.target)) closeGeneratorPicker(); });
window.addEventListener('resize', () => { if (owner) position(); });
document.addEventListener('scroll', event => { if (owner && !popup.contains(event.target)) position(); }, true);
