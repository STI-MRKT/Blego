import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { initialsOf } from '../utils/random.js';
import { FRIENDS, FRIEND_GEOS } from '../data/friends.js';

export function friendsHTML() {
  const selected = state.friendsGeo;
  const list = selected ? FRIENDS.filter((friend) => friend.geo === selected) : FRIENDS;
  const count = (geo) => FRIENDS.filter((friend) => friend.geo === geo).length;
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">PEOPLE</div><h1>Friends</h1>
        <p class="sub">Profile cards by GEO. Pick a region to narrow the list, or keep All to see everyone in order.</p></div>
      <div class="head-actions"><span class="pill">${list.length} profiles</span></div>
    </div>
    <div class="geo-filter">
      <button class="geo-chip ${selected ? '' : 'on'}" data-action="friends-geo" data-geo="">All <b>${FRIENDS.length}</b></button>
      ${FRIEND_GEOS.map((geo) => `<button class="geo-chip ${selected === geo ? 'on' : ''}" data-action="friends-geo" data-geo="${geo}">${geo} <b>${count(geo)}</b></button>`).join('')}
    </div>
    <div class="friends-grid">
      ${list.map((friend) => `<article class="friend-card">
        <div class="friend-top">
          <div class="avatar lg" style="--h:${friend.hue}">${esc(initialsOf(friend.name))}</div>
          <span class="pill tiny">${esc(friend.geo)}</span>
        </div>
        <div class="friend-name">${esc(friend.name)}</div>
        <div class="friend-handle mono">@${esc(friend.handle)}</div>
        <div class="friend-niche">${esc(friend.niche)}</div>
        <a class="btn friend-link" href="${esc(friend.url)}" target="_blank" rel="noreferrer noopener">${I.link}Open profile</a>
      </article>`).join('')}
    </div>
  </div>`;
}
