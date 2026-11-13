import { state } from '../state.js';
import { I } from '../icons.js';
import { viewHTML } from './views.js';

const NAV = [
  { group: 'Workspace', items: [
    { view: 'generator', icon: I.spark, label: 'Generator' },
    { view: 'import', icon: I.upload, label: 'Import' },
    { view: 'news', icon: I.globe, label: 'News' },
  ] },
  { group: 'Tools', items: [
    { view: 'network', icon: I.globe, label: 'Network' },
    { view: 'photos', icon: I.image, label: 'Photos' },
    { view: 'friends', icon: I.users, label: 'Friends' },
    { view: 'checker', icon: I.shield, label: 'Checker' },
    { view: 'settings', icon: I.shield, label: 'Settings' },
    { view: 'history', icon: I.clock, label: 'Archive' }
  ] }
];

export const titleOf = (view) => {
  const item = NAV.flatMap((group) => group.items).find((entry) => entry.view === view);
  return item ? item.label : '';
};

function navItem(item) {
  return `<button class="nav-item ${state.view === item.view ? 'active' : ''}" data-action="set-view" data-view="${item.view}" title="${item.label}" aria-label="${item.label}" ${state.view === item.view ? 'aria-current="page"' : ''}>
    ${item.icon}<span class="label">${item.label}</span>
  </button>`;
}

export function appHTML() {
  return `<div class="stage"><div class="window">
    <aside class="sidebar">
      <div class="side-top">
        <div class="side-brand"><div class="logo">B</div><div class="brand-text"><div class="brand-name">BLEGO</div><div class="brand-sub">local studio</div></div></div>
      </div>
      <nav class="nav" id="workspace-navigation" aria-label="Разделы BLEGO">
        ${NAV.map((group) => `<div class="nav-label">${group.group}</div>${group.items.map(navItem).join('')}`).join('')}
      </nav>
      <div class="side-bottom">
        <div class="side-note" title="Local workspace · no account" aria-label="Local workspace · no account"><span class="dot ok"></span><span class="side-note-text">Local workspace · no account</span></div>
        <div class="credit">powered by <span>blemish&amp;alterego</span></div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" data-action="menu-toggle" aria-controls="workspace-navigation" aria-expanded="false" aria-label="Раскрыть меню" title="Раскрыть меню">${I.chevron}</button><div class="tb-title">${titleOf(state.view)}</div>
        <span class="pill tiny">LOCAL</span>
        <div class="tb-right"></div>
      </header>
      <main class="content" id="view">${viewHTML()}</main>
    </div>
  </div></div>
  <div id="modal-root"></div>`;
}
