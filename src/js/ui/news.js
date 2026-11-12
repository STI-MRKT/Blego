import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const TOPICS = [{ key: '', label: 'Все' }, { key: 'fashion', label: 'Мода' },
  { key: 'ai', label: 'ИИ' }, { key: 'tech', label: 'Технологии' },
  { key: 'finance', label: 'Финансы' }];
function itemHTML(item) {
  return `<article class="news-item-card lift">
    <a class="news-title" href="${esc(item.link)}" target="_blank" rel="noreferrer noopener">
      <h3>${esc(item.title)}</h3></a>
    <div class="news-meta">${esc(item.source || 'Источник')} ${item.publishedAt ? '· '+esc(new Date(item.publishedAt).toLocaleDateString('ru-RU')) : ''}
      ${item.stale ? ' · сохранённая копия' : ''}</div>
    ${item.description ? `<p class="sub ux-news-description">${esc(item.description)}</p>` : ''}
    <div class="news-actions">
      <button class="news-copy" data-action="copy-model" data-source="news"
        data-row="${esc(item.id || String(state.news.items.indexOf(item)))}" data-card="true">${I.copy}<span>Копировать</span></button>
    </div>
  </article>`;
}
function skeletonHTML() {
  return Array.from({ length: 6 }, () => `<article class="news-item-card">
    <div class="sk" style="height:13px;width:92%"></div>
    <div class="sk" style="height:13px;width:65%;margin-top:8px"></div>
    <div class="sk" style="height:9px;width:40%;margin-top:12px"></div></article>`).join('');
}
export function newsBlockHTML() {
  const n = state.news;
  const enabled = !!state.settings.newsEnabled;
  const items = n.items.filter((item) => !n.topic || item.topic === n.topic).slice(0, 20);
  const updated = n.lastSuccessfulAt || (n.updatedAt ? new Date(n.updatedAt).toISOString() : '');
  const topics = TOPICS.filter((topic) => !topic.key || n.items.some((item) => item.topic === topic.key));
  const other = [...new Set(n.items.map((item) => item.topic).filter(Boolean))].filter(
    (key) => !TOPICS.some((topic) => topic.key === key)
  ).map((key) => ({ key, label: key }));
  return `<section class="card news-card ux-news" id="news-block">
    <div class="news-head">
      <div><div class="news-title-main">Новости · Мода, ИИ и технологии</div>
        <div class="news-sub">${updated ? 'Обновлено '+esc(new Date(updated).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})) : 'Выбранные источники · обновление вручную'}</div></div>
      ${enabled ? `<div class="head-actions">
        ${n.loading ? '<button class="btn btn-quiet" data-action="news-cancel">Отмена</button>' : ''}
        <button class="icon-btn ${n.loading ? 'spinning' : ''}" data-action="news-refresh"
          aria-label="Обновить новости" ${n.loading ? 'disabled' : ''}>${I.refresh}</button>
      </div>` : '<button class="btn btn-quiet" data-action="set-view" data-view="settings">Настроить</button>'}
    </div>
    ${!enabled ? '<div class="news-empty">Новостная лента выключена. Включите её и выберите источники в настройках.</div>' : `
      <div class="news-tabs">${[...topics,...other].map((topic) => `<button class="news-tab ${n.topic === topic.key ? 'on' : ''}" data-action="news-topic" data-topic="${esc(topic.key)}">${esc(topic.label)}<b>${topic.key ? n.items.filter((item) => item.topic === topic.key).length : n.items.length}</b></button>`).join('')}</div>
      ${n.loading ? '<div class="news-progress"><i></i></div>' : ''}
      ${n.error ? `<div class="banner warn">${I.alert}<div>${esc(n.error)}</div></div>` : ''}
      <div class="news-grid">${n.loading ? skeletonHTML() : items.length ? items.map(itemHTML).join('') : '<div class="news-empty">Нет новостей из выбранных источников</div>'}</div>
      ${items.length ? `<div class="news-foot">Показано ${items.length} материалов · копирование не открывает ссылку</div>` : ''}
      <details class="ux-details ux-news-sources"><summary>Состояние источников</summary>
        <pre class="ux-json">${esc(JSON.stringify(n.sourceStates || {}, null, 2))}</pre></details>
    `}
  </section>`;
}
