import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { LOCALES } from '../data/locales.js';
import { formatPhoneDisplay } from '../utils/phone.mjs';

const LABELS = {
  name: 'Имя',
  handle: 'Имя пользователя',
  phone: 'Телефон',
  email: 'Электронная почта',
  city: 'Город',
  postalCode: 'Почтовый индекс',
  address: 'Адрес',
  bio: 'О себе',
  status: 'Статус',
  categories: 'Категории',
  symbols: 'Символы',
  number: 'Номер'
};
const QUICK_FIELDS = new Set(['name', 'phone', 'email', 'handle', 'city', 'postalCode', 'address']);

function textValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value == null ? '' : String(value);
}
function fieldHTML(key, value) {
  const text = textValue(value);
  const display = key === 'phone' ? formatPhoneDisplay(text, state.demo?.country) : text;
  const visual = ['email', 'handle'].includes(key)
    ? esc(display).replace(/([.@])/g, '$1<wbr>')
    : esc(display);
  const style = ['phone', 'email', 'postalCode'].includes(key) ? ' mono' : '';
  return `<div class="field">
    <div class="field-main"><div class="field-label">${esc(LABELS[key] || key)}</div>
      <div class="field-value wrap${style}" title="${esc(text)}">${visual}</div></div>
    <button class="copy" data-action="copy-model" data-source="generator" data-field="${esc(key)}" aria-label="Copy ${esc(key)}" title="Копировать">${I.copy}</button>
  </div>`;
}
function loadingHTML() {
  return `<div class="card sk-card">
    <div class="sk-col"><div class="sk" style="width:64px;height:64px;border-radius:50%"></div>
      <div class="sk" style="width:62%;height:16px;margin-top:8px"></div>
      <div class="sk" style="width:42%;height:11px"></div>
      <div class="sk" style="width:88%;height:34px;margin-top:14px"></div></div>
    <div class="sk-col" style="gap:9px">
      <div class="sk" style="width:36%;height:10px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
        ${Array.from({ length: 6 }, () => '<div class="sk" style="height:54px;border-radius:10px"></div>').join('')}
      </div></div></div>`;
}
function profileHTML() {
  if (state.demoBusy) return loadingHTML();
  const p = state.demo;
  if (!p)
    return `<div class="card empty">
    <div class="orb">BLEGO</div><h3>Профиль пока не создан</h3>
    <p>Выберите страну и тип профиля. Все данные формируются локально.</p>
    </div>`;
  const fields = p.fields || {},
    keys = p.fieldOrder || [];
  const primary = ['name', 'phone', 'email', 'postalCode', 'address', 'city', 'handle'].filter((key) =>
    keys.includes(key)
  );
  const extended = keys.filter((key) => !QUICK_FIELDS.has(key));
  const name = textValue(fields.name);
  const hue = [...name].reduce((n, c) => n + c.codePointAt(0), 160) % 360;
  const categories = Array.isArray(fields.categories) ? fields.categories : [];
  const date = Number.isFinite(Date.parse(p.createdAt))
    ? new Date(p.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'сохранено локально';
  return `<article class="card demo-card lift">
    <div class="demo-left">
      <div class="avatar xl" style="--h:${hue}">${esc(
        name
          .split(/\s+/)
          .map((word) => word[0] || '')
          .slice(0, 2)
          .join('')
          .toUpperCase()
      )}</div>
      <div class="name">${esc(name)}</div><div class="handle">@${esc(textValue(fields.handle))}</div>
      <div class="row-chips">${categories
        .slice(0, 4)
        .map((c) => `<span class="pill accent">${esc(c)}</span>`)
        .join('')}</div>
      <p class="bio">${esc(textValue(fields.bio) || textValue(fields.status) || 'Локальный синтетический профиль')}</p>
      <div class="demo-meta">${esc(LOCALES[p.country]?.name?.en || p.country)} · ${esc(p.type)}<br>${esc(date)} · сохранено локально</div>
      <button class="btn btn-primary ux-copy-set" data-action="copy-model" data-source="generator" data-card="true">${I.copy} Copy full set</button>
    </div>
    <div class="demo-right">
      <div class="mini-head"><span class="t">Основные поля</span><span class="ttl"><i></i>Сохранено локально</span></div>
      <div class="fields">${primary.map((key) => fieldHTML(key, fields[key])).join('')}</div>
      ${
        extended.length
          ? `<details class="ux-details ux-extra-fields">
        <summary>Дополнительные поля · ${extended.length}</summary>
        <div class="fields">${extended.map((key) => fieldHTML(key, fields[key])).join('')}</div>
      </details>`
          : ''
      }
      <div class="demo-note">${I.alert}<span>Синтетические данные. Контакты уникальны в рамках истории этой установки, а не во всём мире. Ничего автоматически не отправляется.</span></div>
    </div>
  </article>`;
}
export function ttlText() {
  return 'Сохранено локально';
}
export function generatorHTML() {
  const stats = state.poolStats;
  return `<div class="page ux-generator">
    <div class="page-head">
      <div><div class="eyebrow">BLEGO · LOCAL STUDIO</div><h1>Генератор профилей</h1>
        <p class="sub">Выберите страну, тип и создайте синтетический профиль. Основное — на одном экране.</p></div>
      <div class="head-actions"><span class="pill tiny">Локально · без учётной записи</span></div>
    </div>
    <div class="card controls ux-primary-controls">
      <div class="ctl ctl-sm"><label class="fl">Страна</label><select class="input" data-input="locale">
        ${Object.entries(LOCALES)
          .map(
            ([key, locale]) =>
              `<option value="${key}" ${state.locale === key ? 'selected' : ''}>${esc(locale.name.en)} · ${esc(locale.dial)}</option>`
          )
          .join('')}
      </select></div>
      <div class="ctl ctl-sm"><label class="fl">Тип профиля</label><select class="input" data-input="type">
        ${['model', 'tech', 'crypto'].map((type) => `<option value="${type}" ${state.type === type ? 'selected' : ''}>${type}</option>`).join('')}
      </select></div>
      <div class="ctl-actions">
        <button class="btn btn-quiet" data-action="clear-demo" ${state.demo ? '' : 'disabled'}>Очистить</button>
        <button class="btn btn-primary" data-action="generate" ${state.demoBusy ? 'disabled' : ''}>${I.spark}<span class="lbl">${state.demoBusy ? 'Создаём…' : 'Сгенерировать'}</span></button>
      </div>
    </div>
    ${profileHTML()}
    <details class="card pad ux-details ux-diagnostics">
      <summary>Словари и ограничения</summary>
      <p class="sub">${stats ? `${stats.counts.firstNames} имён · ${stats.counts.lastNames} фамилий · набор ${esc(stats.datasetVersions?.country || '')}` : 'Словари загружаются'}</p>
      <p class="sub">У некоторых стран ограниченные источники имён, улиц и географии. При исчерпании программа сообщит, какого поля не хватает. Подробные настройки — в разделе «Настройки».</p>
    </details>
  </div>`;
}
