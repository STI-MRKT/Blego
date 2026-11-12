import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { NEWS_TOPICS } from '../../../shared/news-catalog.mjs';
function metaValue(value, label, copy=value) {
  return `<span style="display:inline-flex;align-items:center">${esc(value)}<button class="copy tiny always" data-action="copy" data-copy="${esc(copy)}" aria-label="${label}">${I.copy}</button></span>`;
}
export function newsBlockHTML() {
  const n = state.news;
  const items = n.items.filter(i => i.topic === n.topic).slice(0, 40);
  const updated = n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '';
  const skeleton = Array.from({length:10},()=>`<article class="news-item-card"><div class="sk" style="height:13px;width:92%"></div><div class="sk" style="height:13px;width:64%;margin-top:6px"></div><div class="sk" style="height:9px;width:38%;margin-top:10px"></div></article>`).join('');
  return `<section id="news-block" class="card news-card"><div class="news-head"><div><div class="news-title-main">News</div><div class="news-sub">${updated ? `Updated ${esc(updated)}` : 'Headlines from international publications'}</div></div><div><button class="icon-btn ${n.loading?'spinning':''}" data-action="news-refresh" aria-label="Refresh news" ${n.loading?'disabled':''}>${I.refresh}</button>${n.loading?'<button class="btn" data-action="news-cancel">Cancel</button>':''}</div></div>
<div class="news-tabs"><label>Topic <select class="input" id="news-topic" aria-label="News topic">${NEWS_TOPICS.map(t=>`<option value="${t.id}" ${t.id===n.topic?'selected':''}>${t.label}</option>`).join('')}</select></label></div>
${n.loading?'<div class="news-progress"><i></i></div>':''}${n.error?`<div class="banner warn">${I.alert}<div>${esc(n.error)}</div></div>`:''}
<div class="news-grid">${n.loading&&!items.length?skeleton:items.length?items.map(i=>`<article class="news-item-card"><a class="news-title" href="${esc(i.link)}" target="_blank" rel="noreferrer noopener">${esc(i.title)}</a><div class="news-meta">${metaValue(i.source,'Copy news source')} · ${i.publishedAt?metaValue(new Date(i.publishedAt).toLocaleString(),'Copy publication date',new Date(i.publishedAt).toISOString()):'Date not provided'}${i.author?` · ${metaValue(i.author,'Copy article author')}`:''}${i.stale?' · Saved copy':''}</div><div class="news-actions">${[['title','title'],['link','link']].map(([key,label])=>`<button class="news-copy" data-action="copy" data-copy="${esc(i[key])}" aria-label="Copy news ${label}">${I.copy}<span>Copy ${label}</span></button>`).join('')}</div></article>`).join(''):'<div class="news-empty">No stories right now</div>'}</div>
${items.length?`<div class="news-foot">Showing ${items.length} stories${items.length<20?' · Fewer articles are currently available':''}</div>`:''}</section>`;
}
