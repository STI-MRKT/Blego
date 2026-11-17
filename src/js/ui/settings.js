import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { LOCALES } from '../data/locales.js';
export function settingsHTML() {
  const s = state.settings;
  return `<div class="page"><div class="page-head"><div><h1>Настройки</h1><p class="sub">Основные настройки генератора и доступ к инструментам.</p></div></div>
<form id="settings-form" class="card pad ux-settings"><div class="ux-settings-basics">
<label class="fl">Страна по умолчанию<select class="input" name="country">${Object.keys(LOCALES)
    .map((k) => `<option ${s.country === k ? 'selected' : ''}>${k}</option>`)
    .join('')}</select><span class="sub" data-setting-help>Страна для новых профилей; сохранённые данные не меняются.</span></label>
<label class="fl">Тип профиля по умолчанию<select class="input" name="type">${['model', 'tech', 'crypto'].map((k) => `<option ${s.type === k ? 'selected' : ''}>${k}</option>`).join('')}</select><span class="sub" data-setting-help>Тематика новых профилей: model, tech или crypto.</span></label>
<label class="fl">Символы и отметки<input class="input" name="symbols" value="${esc(s.symbols || '')}"><span class="sub" data-setting-help>Ваши отметки для новых профилей. Можно оставить пустым.</span></label>
<div class="ux-settings-toggle-panel"><h3>Доступ к инструментам</h3><p class="sub">Разрешения независимы. Отключение сетевых функций не мешает локальной работе.</p>
<label class="fl"><input type="checkbox" name="proxyEnabled" ${s.proxyEnabled ? 'checked' : ''}> Разрешить проверку сети и прокси<span class="sub" data-setting-help>Подключение проверяется по вашей команде; скорость измеряется отдельной кнопкой.</span></label>
<label class="fl"><input type="checkbox" name="facebookEnabled" ${s.facebookEnabled ? 'checked' : ''}> Разрешить проверку публичных Facebook-профилей<span class="sub" data-setting-help>Проверяет доступность страницы по вашему запросу, без вывода о блокировке аккаунта.</span></label>
<label class="fl"><input type="checkbox" name="newsEnabled" ${s.newsEnabled ? 'checked' : ''}> Разрешить загрузку новостей<span class="sub" data-setting-help>Новости выбранной темы из встроенного каталога при открытии ленты или обновлении.</span></label>
</div></div>
<button class="btn btn-primary ux-save-settings" type="submit">Сохранить настройки</button>
</form></div>`;
}
export function readSettingsForm(form) {
  const data = new FormData(form);
  // Advanced preferences stay in storage and are not overwritten by a hidden form.
  // Optional finite values may always repeat; contact identifiers stay unique
  // through the existing registry.
  return {
    country: data.get('country'),
    type: data.get('type'),
    symbols: data.get('symbols'),
    bulkMode: true,
    bulkConsent: true,
    proxyEnabled: data.has('proxyEnabled'),
    facebookEnabled: data.has('facebookEnabled'),
    newsEnabled: data.has('newsEnabled')
  };
}
