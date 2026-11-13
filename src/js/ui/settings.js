import { state } from '../state.js';
import { esc } from '../utils/dom.js';
import { LOCALES } from '../data/locales.js';
export function settingsHTML() {
  const s = state.settings;
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">Локальные настройки</div><h1>Настройки</h1><p class="sub">Основное всегда под рукой. Сложные параметры собраны в дополнительном разделе.</p></div></div>
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
<details class="ux-details ux-settings-advanced"><summary>Дополнительные настройки, словари, форматы и архив</summary>
<label class="fl">Field order (comma separated)<input class="input" name="fieldOrder" value="${esc((s.fieldOrder || []).join(','))}"></label>
<label class="fl">Disabled optional fields<input class="input" name="disabledFields" value="${esc((s.disabledFields || []).join(','))}"></label>
<label class="fl">Allow repeats for finite optional fields<input class="input" name="allowRepeats" value="${esc((s.allowRepeats || []).join(','))}"></label>
<p class="sub">Phone, email and handle always remain unique. Finite dictionaries can run out.</p>
<label class="fl"><input type="checkbox" name="bulkMode" ${s.bulkMode ? 'checked' : ''}> Multiple generation: I allow biographies, statuses, postal codes, addresses and numbers to repeat. Phone, email and handle remain unique.</label>
<p class="sub">Data package: ${esc(state.poolStats?.datasetId || 'not loaded')} · ${esc(state.poolStats?.datasetVersions?.country || '')}. Bundled female-name vocabularies have documented size and geography deficits.</p>
<button type="button" class="btn" data-action="pool-choose">Preview JSON / ZIP data package</button>
<button type="button" class="btn" data-action="pool-bundled">Use bundled data for ${esc(state.locale)}</button>
${state.poolStats?.installedVersions?.length ? `<label class="fl">Installed versions<select id="pool-version" class="input">${state.poolStats.installedVersions.map((v) => `<option value="${esc(v.key)}">${esc(v.version)}</option>`).join('')}</select></label><button type="button" class="btn" data-action="pool-select">Use selected version</button>` : ''}
${
  state.poolStats
    ? `<p class="sub">Dataset counts: ${state.poolStats.counts.firstNames}/500 female names; ${state.poolStats.counts.lastNames}/500 surnames; ${state.poolStats.counts.localities}/50 localities. Independently verified postal links in bundled data: 0/200. Imported verification counts are declarations from their source.</p><div class="fields">${Object.entries(
        state.poolStats.capacities
      )
        .map(
          ([field, value]) =>
            `<div class="field"><span>${esc(field)}</span><span>${value.available ?? 'Unknown'} · ${esc(value.certainty)}${value.repeatAllowed ? ' · repetition permitted' : ''}</span></div>`
        )
        .join(
          ''
        )}</div><p class="sub">Name combinations do not measure complete-profile capacity. Telephone capacity is a synthetic format estimate; numbers are not verified as unassigned.</p>`
    : ''
}
${state.poolImport ? `<div class="card pad"><p>${esc(state.poolImport.country)} · ${esc(state.poolImport.datasetVersion)}: ${state.poolImport.counts.firstNames} female names, ${state.poolImport.counts.lastNames} surnames, ${state.poolImport.counts.localityPostalLinks} postal links. License: ${esc(state.poolImport.sourceLicenses.join(', '))}. Existing issued values remain reserved.</p><button type="button" class="btn" data-action="pool-apply">Apply reviewed package</button><button type="button" class="btn" data-action="pool-cancel">Cancel</button></div>` : ''}
<label class="fl">Local rule overrides (JSON: common, types, pairs)<textarea class="input" name="overrides" rows="5">${esc(JSON.stringify(s.overrides || {}, null, 2))}</textarea></label>
<p class="sub">Archive folder: ${esc(s.archiveRoot || 'Application data / archives')}</p><button type="button" class="btn" data-action="archive-directory">Choose archive folder</button>
<label class="fl"><input type="checkbox" name="includeOriginal" ${s.includeOriginal ? 'checked' : ''}> Include original bytes in future ZIPs (off by default)</label>
<label class="fl">Refresh interval<select class="input" name="newsInterval">${[15, 30, 60, 180].map((n) => `<option value="${n}" ${s.newsInterval === n ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></label>
</details><button class="btn btn-primary ux-save-settings" type="submit">Сохранить настройки</button>
</form></div>`;
}
export function readSettingsForm(form) {
  const data = new FormData(form);
  const list = (k) =>
    String(data.get(k) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    country: data.get('country'),
    type: data.get('type'),
    symbols: data.get('symbols'),
    fieldOrder: list('fieldOrder'),
    disabledFields: list('disabledFields'),
    allowRepeats: list('allowRepeats'),
    bulkMode: data.has('bulkMode'),
    bulkConsent: data.has('bulkMode'),
    overrides: JSON.parse(data.get('overrides')),
    includeOriginal: data.has('includeOriginal'),
    proxyEnabled: data.has('proxyEnabled'),
    facebookEnabled: data.has('facebookEnabled'),
    newsEnabled: data.has('newsEnabled'),
    newsInterval: Number(data.get('newsInterval')),
    newsSources: state.settings.newsSources || []
  };
}
