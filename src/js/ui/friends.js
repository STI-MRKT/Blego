import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { initialsOf } from '../utils/random.js';
import { FRIENDS } from '../data/friends.js';
function pager(page, count, action) {
  return count > 1
    ? `<div class="head-actions"><button class="btn" data-action="${action}" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>Назад</button><span>${page + 1} / ${count}</span><button class="btn" data-action="${action}" data-page="${page + 1}" ${page + 1 >= count ? 'disabled' : ''}>Далее</button></div>`
    : '';
}
function previewHTML() {
  const preview = state.friendsPreview;
  if (!preview) return '';
  const pages = Math.max(1, Math.ceil(preview.rows.length / 100)),
    page = Math.max(0, Math.min(state.friendsPreviewPage || 0, pages - 1));
  const statuses = {
    new: 'Новая',
    duplicate: 'Уже есть',
    incomplete: 'Неполная запись',
    invalid: 'Некорректная ссылка или поля'
  };
  return `<section class="card pad" data-friends-preview><h3>Подтвердите импорт</h3><p>Новых: ${preview.added} · Повторов: ${preview.duplicates} · Неполных: ${preview.incomplete} · Ошибок: ${preview.invalid}</p><p class="sub">Отсутствующие имя, GEO и тематика останутся пустыми.</p>${pager(page, pages, 'friends-preview-page')}<div class="table-wrap"><table class="tbl"><thead><tr><th>Имя</th><th>Ссылка</th><th>GEO</th><th>Результат</th></tr></thead><tbody>${preview.rows
    .slice(page * 100, (page + 1) * 100)
    .map(
      (row) =>
        `<tr><td>${esc(row.name || '')}</td><td>${esc(row.url || '')}</td><td>${esc(row.geo || '')}</td><td>${statuses[row.status]}</td></tr>`
    )
    .join(
      ''
    )}</tbody></table></div><div class="head-actions"><button class="btn btn-primary" data-action="friends-confirm" ${!preview.added || state.friendsBusy ? 'disabled' : ''}>Добавить подтверждённые записи</button><button class="btn" data-action="friends-cancel">Отмена</button></div></section>`;
}
export function friendsHTML() {
  const all =
    state.friendsRows ||
    FRIENDS.map((row, i) => ({ ...row, id: `seed-${i}`, platform: 'Instagram' }));
  const selected = state.friendsGeo,
    query = (state.friendsQuery || '').toLocaleLowerCase();
  const list = all.filter(
    (friend) =>
      (!selected || friend.geo === selected) &&
      (!state.friendsPlatform || friend.platform === state.friendsPlatform) &&
      (!query ||
        [friend.name, friend.url, friend.geo, friend.niche, friend.notes].some((v) =>
          String(v || '')
            .toLocaleLowerCase()
            .includes(query)
        ))
  );
  const geos = [...new Set(all.map((f) => f.geo).filter(Boolean))].sort(),
    platforms = [...new Set(all.map((f) => f.platform).filter(Boolean))].sort();
  const count = (geo) => all.filter((friend) => friend.geo === geo).length;
  const pages = Math.max(1, Math.ceil(list.length / 100)),
    page = Math.max(0, Math.min(state.friendsPage || 0, pages - 1));
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">PEOPLE</div><h1>Friends</h1><p class="sub">Профили по GEO. Выберите регион или найдите нужную карточку.</p></div>
      <div class="head-actions"><span class="pill">${list.length} / ${all.length} profiles</span><button class="btn" data-action="friends-import" ${state.friendsBusy ? 'disabled' : ''}>Импортировать Friends</button></div>
    </div>
    <form id="friends-search" class="controls"><label class="fl">Поиск<input class="input" id="friends-query" value="${esc(state.friendsQuery || '')}"></label><label class="fl">Площадка<select class="input" id="friends-platform"><option value="">Все</option>${platforms.map((platform) => `<option ${state.friendsPlatform === platform ? 'selected' : ''}>${esc(platform)}</option>`).join('')}</select></label><button class="btn" type="submit">Найти</button></form>
    <div class="geo-filter">
      <button class="geo-chip ${selected ? '' : 'on'}" data-action="friends-geo" data-geo="">All <b>${all.length}</b></button>
      ${geos.map((geo) => `<button class="geo-chip ${selected === geo ? 'on' : ''}" data-action="friends-geo" data-geo="${esc(geo)}">${esc(geo)} <b>${count(geo)}</b></button>`).join('')}
    </div>
    ${previewHTML()}${pager(page, pages, 'friends-page')}
    <div class="friends-grid">
      ${list
        .slice(page * 100, (page + 1) * 100)
        .map(
          (friend) => `<article class="friend-card">
        <div class="friend-top"><div class="avatar lg" style="--h:${Number(friend.hue) || 240}">${esc(initialsOf(friend.name || ''))}</div><span class="pill tiny">${esc(friend.geo)}</span></div>
        <div class="friend-name">${esc(friend.name)}${friend.name ? `<button class="copy tiny always" data-action="copy" data-copy="${esc(friend.name)}" aria-label="Копировать имя">${I.copy}</button>` : ''}</div>
        <div class="friend-handle mono">${friend.handle ? '@' + esc(friend.handle) : ''}</div><div class="friend-niche">${esc(friend.niche)}</div>
        <div class="head-actions"><button class="btn friend-link" data-action="friends-open" data-id="${esc(friend.id)}">${I.link}Open profile</button><button class="btn" data-action="copy" data-copy="${esc(friend.url)}" data-friend-copy="url" aria-label="Копировать ссылку">${I.copy}</button></div>
        ${
          friend.source
            ? `<details><summary>Подробнее</summary><p class="sub">${esc(friend.platform)} · ${esc(friend.source)}</p><p>${esc(friend.notes || '')}</p>${Object.entries(
                friend.extraFields || {}
              )
                .map(([key, value]) => `<p>${esc(key)}: ${esc(value)}</p>`)
                .join('')}</details>`
            : ''
        }
      </article>`
        )
        .join('')}
    </div>
  </div>`;
}
