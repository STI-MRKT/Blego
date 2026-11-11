import { state } from '../state.js';
import { t } from '../i18n.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { fmtDate } from '../utils/time.js';
import { initialsOf } from '../utils/random.js';
import { LOCALES } from '../data/locales.js';
import { catLabel } from '../data/categories.js';
import { newsBlockHTML } from './news.js';

export function ttlText() {
  if (!state.demo) return '30:00';
  const seconds = Math.max(0, Math.floor((state.demo.expiresAt - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function fieldHTML(label, value, options = {}) {
  const copyValue = options.copy ?? value;
  const display = options.breakAt && String(value).includes(options.breakAt)
    ? String(value).split(options.breakAt).map(esc).join(`<wbr>${esc(options.breakAt)}`)
    : esc(value);
  return `<div class="field">
    <div class="field-main">
      <div class="field-label">${esc(label)}</div>
      <div class="field-value${options.mono ? ' mono' : ''}${options.wrap ? ' wrap' : ''}" title="${esc(value)}">${display}</div>
    </div>
    <button class="copy" data-action="copy" data-copy="${esc(copyValue)}" aria-label="${t('Копировать', 'Copy')}" title="${t('Копировать', 'Copy')}">${I.copy}</button>
  </div>`;
}

function demoAreaHTML() {
  if (state.demoBusy) {
    return `<div class="card sk-card">
      <div class="sk-col">
        <div class="sk" style="width:64px;height:64px;border-radius:50%"></div>
        <div class="sk" style="width:62%;height:16px;margin-top:8px"></div>
        <div class="sk" style="width:42%;height:11px"></div>
        <div class="sk" style="width:88%;height:34px;margin-top:14px"></div>
        <div class="sk" style="width:70%;height:11px;margin-top:14px"></div>
      </div>
      <div class="sk-col" style="gap:9px">
        <div class="sk" style="width:36%;height:10px"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          ${Array.from({ length: 6 }, () => '<div class="sk" style="height:54px;border-radius:10px"></div>').join('')}
        </div>
        <div class="sk" style="width:66%;height:10px;margin-top:8px"></div>
      </div>
    </div>`;
  }
  if (!state.demo) {
    return `<div class="card empty">
      <div class="orb">DEMO</div>
      <h3>${t('Пока нет ни одного набора', 'No demo set yet')}</h3>
      <p>${t('Выберите локаль — категории страниц и остальные поля подберутся автоматически.', 'Pick a locale — page categories and the rest of the fields follow automatically.')}</p>
      <button class="btn btn-primary" data-action="generate">${I.spark}${t('Сгенерировать первый набор', 'Generate first set')}</button>
    </div>`;
  }
  const demo = state.demo;
  const locale = LOCALES[demo.locale];
  return `<article class="card demo-card lift">
    <div class="demo-left">
      <div class="avatar xl" style="--h:${demo.hue}">${esc(initialsOf(demo.name))}</div>
      <div class="name">${esc(demo.name)}</div>
      <div class="handle">@${esc(demo.handle)}</div>
      <div class="cat-label">${t('Категории страницы', 'Page categories')}</div>
      <div class="row-chips">
        ${demo.categories.map((key) => `<span class="pill accent">${esc(catLabel(key))}</span>`).join('')}
      </div>
      <p class="bio">${esc(demo.bio)}</p>
      <div class="demo-meta">
        ${esc(locale.name.en)} · ${t('создано', 'created')} ${fmtDate(demo.createdAt)}<br>
        ${t('Очистится через', 'Clears in')} <b id="ttl">${ttlText()}</b>
      </div>
    </div>
    <div class="demo-right">
      <div class="mini-head">
        <span class="t">${t('Поля профиля', 'Profile fields')}</span>
        <span class="ttl"><i></i>${t('30 минут', '30 minutes')}</span>
      </div>
      <div class="fields">
        ${fieldHTML(t('Полное имя', 'Full name'), demo.name)}
        ${fieldHTML(t('Телефон', 'Phone'), demo.phone, { mono: true, copy: demo.phoneCopy })}
        ${fieldHTML('Email', demo.email, { mono: true, wrap: true, breakAt: '@' })}
        ${fieldHTML(t('Почтовый индекс', 'Postal code'), demo.postal, { mono: true })}
        ${fieldHTML(t('Адрес', 'Address'), demo.address)}
        ${fieldHTML(t('Город', 'City'), demo.city)}
      </div>
      <div class="demo-note">${I.alert}<span>${t('Данные сгенерированы локально и помечены как DEMO. Не предназначены для регистрации на платформах. Набор живёт 30 минут или до следующей генерации.', 'Generated locally and marked DEMO. Not intended for registration anywhere. The set lives for 30 minutes or until the next generation.')}</span></div>
    </div>
  </article>`;
}

export function generatorHTML() {
  const locales = Object.keys(LOCALES);
  return `<div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">${t('Студия', 'Studio')} · DEMO</div>
        <h1>${t('Генератор демо-данных', 'Demo data generator')}</h1>
        <p class="sub">${t('Синтетические профили для макетов, тестовых стендов и портфолио-кейсов. Только DEMO — не для регистрации.', 'Synthetic profiles for mockups, test benches and portfolio cases. DEMO only — never for registration.')}</p>
      </div>
      <div class="head-actions">
        <span class="ttl"><i></i><span class="mono" id="ttl-top">${ttlText()}</span></span>
      </div>
    </div>
    <div class="card controls">
      <div class="ctl ctl-sm">
        <label class="fl">${t('Локаль', 'Locale')}</label>
        <select class="input" data-input="locale">
          ${locales.map((key) => `<option value="${key}" ${state.locale === key ? 'selected' : ''}>${LOCALES[key].name.en} · ${LOCALES[key].dial}</option>`).join('')}
        </select>
      </div>
      <div class="ctl-hint">${t('Категории страницы выбираются автоматически — три случайные, как в Facebook. Выбор только за GEO.', 'Page categories are picked automatically — three random ones, Facebook-style. Only GEO is yours to choose.')}</div>
      <div class="ctl-actions">
        <button class="btn btn-quiet" data-action="clear-demo" ${state.demo ? '' : 'disabled'}>${t('Очистить', 'Clear')}</button>
        <button class="btn btn-primary" data-action="generate" ${state.demoBusy ? 'disabled' : ''}>${I.spark}<span class="lbl">${t('Сгенерировать', 'Generate')}</span></button>
      </div>
    </div>
    ${demoAreaHTML()}
    ${newsBlockHTML()}
  </div>`;
}
