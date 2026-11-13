import { biographyHTML } from './biography.js';
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

function textValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value == null ? '' : String(value);
}
function conciseHandle(value, max = 28) {
  const text = textValue(value);
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
function conciseEmail(value) {
  const text = textValue(value);
  const at = text.lastIndexOf('@');
  if (at < 1) return text;
  const domain = text.slice(at + 1);
  const local = text.slice(0, at);
  const visible = Math.max(4, 18 - domain.length - 2);
  return local.length > visible ? local.slice(0, visible) + '…@' + domain : text;
}
function fieldHTML(key, value) {
  const text = textValue(value);
  const display =
    key === 'phone'
      ? formatPhoneDisplay(text, state.demo?.country)
      : key === 'email'
        ? conciseEmail(text)
        : key === 'handle'
          ? conciseHandle(text)
          : text;
  const visual = ['email', 'handle'].includes(key)
    ? esc(display).replace(/([.@])/g, '$1<wbr>')
    : esc(display);
  const style = ['phone', 'email', 'postalCode'].includes(key) ? ' mono' : '';
  const rowStyle = ['phone', 'email'].includes(key) ? ` field-${key}` : '';
  return `<div class="field${rowStyle}">
    <div class="field-main"><div class="field-label">${esc(LABELS[key] || key)}</div>
      <div class="field-value wrap${style}" title="${esc(text)}">${visual}</div></div>
    <button class="copy" data-action="copy-model" data-source="generator" data-field="${esc(key)}" ${key === 'phone' ? 'data-national-phone="true"' : ''} aria-label="Copy ${esc(key)}" title="Копировать">${I.copy}</button>
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
  const primary = ['name', 'phone', 'email', 'address', 'city', 'postalCode', 'handle'].filter((key) =>
    keys.includes(key)
  );
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
      <div class="ux-profile-copy"><div class="name">${esc(name)}</div><button class="copy" data-action="copy-model" data-source="generator" data-field="name" aria-label="Копировать имя" title="Копировать имя">${I.copy}</button></div><div class="handle" title="${esc(textValue(fields.handle))}">@${esc(conciseHandle(fields.handle, 26))}</div>
      <div class="row-chips">${categories
        .slice(0, 4)
        .map((c) => `<button class="pill accent" data-action="copy" data-copy="${esc(c)}" aria-label="Copy category ${esc(c)}">${esc(c)}</button>`)
        .join('')}</div>
      <div class="ux-profile-copy"><p class="bio">${esc(textValue(fields.bio) || textValue(fields.status) || 'Локальный синтетический профиль')}</p><button class="copy" data-action="copy-model" data-source="generator" data-field="bio" aria-label="Копировать BIO" title="Копировать BIO" ${textValue(fields.bio) ? '' : 'disabled'}>${I.copy}</button></div>
      <div class="demo-meta">${esc(LOCALES[p.country]?.name?.en || p.country)} · ${esc(p.type)}<br>${esc(date)} · сохранено локально</div>
      <button class="btn btn-primary ux-copy-set" data-action="copy-model" data-source="generator" data-card="true">${I.copy} Copy full set</button>
    </div>
    <div class="demo-right">
      <div class="mini-head"><span class="t">Основные поля</span><span class="ttl"><i></i>Сохранено локально</span></div>
      <div class="fields">${primary.map((key) => fieldHTML(key, fields[key])).join('')}</div>
      <div class="demo-note">${I.alert}<span>Синтетический профиль. Сохранён на этом устройстве.</span></div>
    </div>
  </article>`;
}
export function ttlText() {
  return 'Сохранено локально';
}
export function generatorHTML() {
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
    ${state.demo?`<div class="head-actions"><button class="btn" data-action="generator-tab" data-tab="profile" aria-pressed="${state.generatorTab!=='bio'}">Профиль</button><button class="btn" data-action="generator-tab" data-tab="bio" aria-pressed="${state.generatorTab==='bio'}">BIO</button></div>`:''}
    ${state.demo&&state.generatorTab==='bio'?biographyHTML():profileHTML()}

  </div>`;
}
