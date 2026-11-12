import { state } from '../state.js';
import { I } from '../icons.js';
import { viewHTML } from './views.js';

const NAV = [
  { group: 'Workspace', items: [
    { view: 'generator', icon: I.spark, label: 'Generator' },
    { view: 'import', icon: I.upload, label: 'Import' },
    { view: 'history', icon: I.clock, label: 'History' },
    { view: 'settings', icon: I.shield, label: 'Settings' }
  ] },
  { group: 'Tools', items: [
    { view: 'network', icon: I.globe, label: 'Network' },
    { view: 'photos', icon: I.image, label: 'Photos' },
    { view: 'friends', icon: I.users, label: 'Friends' },
    { view: 'checker', icon: I.shield, label: 'Checker' }
  ] }
];

export const titleOf = (view) => {
  const item = NAV.flatMap((group) => group.items).find((entry) => entry.view === view);
  return item ? item.label : '';
};

function navItem(item) {
  return `<button class="nav-item ${state.view === item.view ? 'active' : ''}" data-action="set-view" data-view="${item.view}">
    ${item.icon}<span class="label">${item.label}</span>
  </button>`;
}

export function appHTML() {
  return `<div class="stage"><div class="window">
    <aside class="sidebar">
      <div class="side-top">
        <div class="side-brand"><div class="logo">B</div><div class="brand-text"><div class="brand-name">BLEGO</div><div class="brand-sub">local studio</div></div></div>
      </div>
      <nav class="nav">
        ${NAV.map((group) => `<div class="nav-label">${group.group}</div>${group.items.map(navItem).join('')}`).join('')}
      </nav>
      <div class="side-bottom">
        <div class="side-note"><span class="dot ok"></span>Local workspace · no account</div>
        <div class="credit">powered by <span>blemish&amp;alterego</span></div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="tb-title">${titleOf(state.view)}</div>
        <span class="pill tiny">LOCAL</span>
        <div class="tb-right"></div>
      </header>
      <main class="content" id="view">${viewHTML()}</main>
    </div>
  </div></div>
  <div id="modal-root"></div>`;
}
