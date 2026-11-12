import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { rel } from '../utils/time.js';

import { NEWS_TOPICS } from '../../../shared/news-catalog.mjs';

const SHOWN = 20;

function countOf(key) {
  if (!key) return Math.min(SHOWN, state.news.items.length);
  return Math.min(SHOWN, state.news.items.filter((item) => item.topic === key).length);
}

function visibleItems() {
  const topic = state.news.topic || 'fashion';
  if (topic) return state.news.items.filter((item) => item.topic === topic).slice(0, SHOWN);
  const map = new Map(state.news.items.map((item) => [item.link, item]));
  const ordered = state.news.order.map((link) => map.get(link)).filter(Boolean);
  const base = ordered.length ? ordered : state.news.items;
  return base.slice(0, SHOWN);
}

function itemHTML(item) {
  return `<article class="news-item-card">
    <a class="news-title" href="${esc(item.link)}" target="_blank" rel="noreferrer noopener"><h3>${esc(item.title)}</h3></a>
    <div class="news-meta">${esc(item.source)}${item.publishedAt ? ` · ${rel(item.publishedAt)}` : ''}</div>
    <div class="news-actions">
      <button class="news-copy" data-action="copy" data-copy="${esc(item.title)}" title="Copy title">${I.copy}<span>Copy title</span></button>
      <button class="news-copy" data-action="copy" data-copy="${esc(item.link)}" title="Copy link">${I.copy}<span>Copy link</span></button>
    </div>
  </article>`;
}

function skeletonHTML() {
  return Array.from(
    { length: 10 },
    () => `<article class="news-item-card">
    <div class="sk" style="height:13px;width:92%"></div>
    <div class="sk" style="height:13px;width:64%;margin-top:6px"></div>
    <div class="sk" style="height:9px;width:38%;margin-top:10px"></div>
  </article>`
  ).join('');
}

export function newsBlockHTML() {
  const news = state.news;
  const items = visibleItems();
  const updated = news.updatedAt
    ? new Date(news.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  return `<section class="card news-card" id="news-block">
    <div class="news-head">
      <div>
        <div class="news-title-main">Новости</div>
        <div class="news-sub">Зарубежные источники${updated ? ` · updated ${updated}` : ''}</div>
      </div>
      <div class="head-actions"><select class="input" id="news-topic" aria-label="Тема новостей">${NEWS_TOPICS.map((topic) => `<option value="${topic.id}" ${(state.news.topic || 'fashion') === topic.id ? 'selected' : ''}>${topic.label}</option>`).join('')}</select><button class="icon-btn ${news.loading ? 'spinning' : ''}" data-action="news-refresh" aria-label="Refresh news" ${news.loading ? 'disabled' : ''}>${I.refresh}</button></div>
    </div>
    ${news.loading ? '<div class="news-progress"><i></i></div>' : ''}
    ${news.error ? `<div class="banner warn">${I.alert}<div>${esc(news.error)}</div></div>` : ''}
    <div class="news-grid">
      ${news.loading ? skeletonHTML() : items.length ? items.map(itemHTML).join('') : `<div class="news-empty">Нет заголовков из доступных источников</div>`}
    </div>
    ${!news.loading && items.length ? `<div class="news-foot">Заголовки: ${items.length}${items.length < SHOWN ? ' · Доступно меньше 20' : ''} · copy title or link without opening the article</div>` : ''}
  </section>`;
}
