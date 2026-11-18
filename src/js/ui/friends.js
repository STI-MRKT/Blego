import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { initialsOf } from '../utils/random.js';
import { FRIENDS } from '../data/friends.js';
import { filterFriends, uniqueFriendLinks } from '../../../shared/friends-copy.mjs';
const currentRows = () => state.friendsRows || FRIENDS.map((row, i) => ({ ...row, id: `seed-${i}`, platform: 'Instagram', copyUrl: row.url }));
const currentFilter = () => ({ geo: state.friendsGeo, platform: state.friendsPlatform, query: state.friendsQuery });
export const friendsCopyLinks = () => uniqueFriendLinks(filterFriends(currentRows(), currentFilter()));
export function syncFriendsCopyActions() {
  const count = friendsCopyLinks().length;
  const seven = document.querySelector('[data-friends-copy="seven"]'), all = document.querySelector('[data-friends-copy="all"]');
  if (seven) seven.disabled = Boolean(state.friendsCopyBusy) || count < 7;
  if (all) all.disabled = Boolean(state.friendsCopyBusy) || count === 0;
  const message = document.querySelector('[data-friends-copy-empty]');
  if (message) message.textContent = count ? '' : 'Нет доступных ссылок';
}
function pager(page, count, action) {
  return count > 1
    ? `<div class="head-actions"><button class="btn" data-action="${action}" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>Назад</button><span>${page + 1} / ${count}</span><button class="btn" data-action="${action}" data-page="${page + 1}" ${page + 1 >= count ? 'disabled' : ''}>Далее</button></div>`
    : '';
}
export function friendsHTML() {
  const all = currentRows(), selected = state.friendsGeo;
  const list = filterFriends(all, currentFilter()), links = uniqueFriendLinks(list);
  const geos = [...new Set(all.map((f) => f.geo).filter(Boolean))].sort(),
    platforms = [...new Set(all.map((f) => f.platform).filter(Boolean))].sort();
  const count = (geo) => all.filter((friend) => friend.geo === geo).length;
  const pages = Math.max(1, Math.ceil(list.length / 100)),
    page = Math.max(0, Math.min(state.friendsPage || 0, pages - 1));
  return `<div class="page">
    <div class="page-head">
      <div><h1>Friends</h1><p class="sub">Профили по GEO. Выберите регион или найдите нужную карточку.</p></div>
      <div class="head-actions"><span class="pill friends-count">${list.length} / ${all.length} profiles</span></div>
    </div>
    <form id="friends-search" class="controls"><label class="fl">Поиск<input class="input" id="friends-query" value="${esc(state.friendsQuery || '')}"></label><label class="fl">Площадка<select class="input" id="friends-platform"><option value="">Все</option>${platforms.map((platform) => `<option ${state.friendsPlatform === platform ? 'selected' : ''}>${esc(platform)}</option>`).join('')}</select></label><button class="btn" type="submit">Найти</button></form>
    <div class="geo-filter">
      <button class="geo-chip ${selected ? '' : 'on'}" data-action="friends-geo" data-geo="">All <b>${all.length}</b></button>
      ${geos.map((geo) => `<button class="geo-chip ${selected === geo ? 'on' : ''}" data-action="friends-geo" data-geo="${esc(geo)}">${esc(geo)} <b>${count(geo)}</b></button>`).join('')}
    </div>
    <div class="head-actions friends-copy-actions"><button class="btn" data-action="friends-copy" data-friends-copy="seven" ${links.length < 7 || state.friendsCopyBusy ? 'disabled' : ''}>${I.copy}Скопировать 7</button><button class="btn" data-action="friends-copy" data-friends-copy="all" ${!links.length || state.friendsCopyBusy ? 'disabled' : ''}>${I.copy}Скопировать все</button><span class="sub" data-friends-copy-empty aria-live="polite">${links.length ? '' : 'Нет доступных ссылок'}</span></div>
    ${pager(page, pages, 'friends-page')}
    <div class="friends-grid">
      ${list
        .slice(page * 100, (page + 1) * 100)
        .map(
          (friend) => `<article class="friend-card fp-friend-card" data-copy-surface>
        <div class="friend-top"><div class="avatar xl" style="--h:${Number(friend.hue) || 240}">${esc(initialsOf(friend.name || ''))}</div><span class="pill tiny">${esc(friend.geo)}</span></div>
        <div class="friend-name">${esc(friend.name || friend.url)}${friend.name ? `<button class="copy tiny always" data-action="copy" data-copy="${esc(friend.name)}" aria-label="Копировать имя">${I.copy}</button>` : ''}</div>
        <div class="friend-handle mono">${friend.handle ? '@' + esc(friend.handle) : ''}</div><div class="row-chips friend-tags">${friend.niche ? `<button class="pill accent" data-action="copy" data-copy="${esc(friend.niche)}" aria-label="Копировать тематику">${esc(friend.niche)}</button>` : ''}</div>${friend.notes ? `<p class="friend-note">${esc(friend.notes.slice(0, 180))}</p>` : ''}
        <div class="head-actions friend-actions"><button class="btn friend-link" data-action="friends-open" data-id="${esc(friend.id)}">${I.link}Open profile</button><button class="btn" data-action="copy" data-copy="${esc(friend.url)}" data-friend-copy="url" aria-label="Копировать ссылку">${I.copy}</button></div>

      </article>`
        )
        .join('')}
    </div>
  </div>`;
}
