import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { LOCALES } from '../data/locales.js';
import { newsBlockHTML } from './news.js';
function fieldHTML(key, value) {
  const label=({name:'Name',phone:'Phone',email:'Email',postalCode:'Postal code',address:'Address',city:'City'})[key] || key;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return `<div class="field"><div class="field-main"><div class="field-label">${esc(label)}</div><div class="field-value wrap">${esc(text)}</div></div><button class="copy" data-action="copy-model" data-source="generator" data-field="${esc(key)}" aria-label="Copy ${esc(key)}">${I.copy}</button></div>`;
}
export function ttlText() {
  return 'Saved locally';
}
export function generatorHTML() {
  const p = state.demo;
  const primary = ['name', 'phone', 'email', 'postalCode', 'address', 'city'];
  const extra = p?.fieldOrder.filter((k) => !primary.includes(k) && !['handle', 'bio'].includes(k)) || [];
  const hue = [...(p?.fields.name || '')].reduce((n, c) => n + c.codePointAt(0), 240) % 360;
  const initials = (p?.fields.name || 'B')
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  return `<div class="page">
<div class="page-head"><div><div class="eyebrow">Studio · DEMO</div><h1>Demo data generator</h1><p class="sub">Synthetic profiles for mockups, test benches and portfolio cases.</p></div></div>
<div class="card controls"><div class="ctl ctl-sm"><label class="fl">Country</label><select class="input" data-input="locale">${Object.entries(
    LOCALES
  )
    .map(
      ([k, l]) =>
        `<option value="${k}" ${state.locale === k ? 'selected' : ''}>${esc(l.name.en)} · ${esc(l.dial)}</option>`
    )
    .join('')}</select></div>
<div class="ctl ctl-sm"><label class="fl">Type</label><select class="input" data-input="type">${['model', 'tech', 'crypto'].map((k) => `<option ${state.type === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>

<div class="ctl-actions"><button class="btn btn-quiet" data-action="clear-demo" ${p ? '' : 'disabled'}>Clear</button><button class="btn btn-primary" data-action="generate" ${state.demoBusy ? 'disabled' : ''}>${I.spark}${state.demoBusy ? 'Generating…' : 'Generate'}</button></div></div>
${state.demoError?`<div class="banner warn"><span>${esc(state.demoError)}</span><button class="btn btn-quiet" data-action="set-view" data-view="settings">Settings</button></div>`:''}
${
  state.demoBusy
    ? `<div class="card sk-card"><div class="sk-col"><div class="sk" style="width:64px;height:64px;border-radius:50%"></div><div class="sk" style="width:62%;height:16px"></div><div class="sk" style="width:88%;height:34px"></div></div><div class="sk-col">${Array.from({ length: 6 }, () => '<div class="sk" style="height:54px;border-radius:10px"></div>').join('')}</div></div>`
    : p
      ? `<article class="card demo-card lift"><div class="demo-left"><div class="avatar xl" style="--h:${hue}">${esc(initials)}</div><div class="name">${esc(p.fields.name)}</div><div class="handle" style="overflow-wrap:anywhere;min-width:0">@${esc(p.fields.handle || '')}<button class="copy tiny always" data-action="copy-model" data-source="generator" data-field="handle" aria-label="Copy handle">${I.copy}</button></div><div class="cat-label">Page categories</div><div class="row-chips">${(p.fields.categories || []).map((c) => `<button class="pill accent" data-action="copy" data-copy="${esc(c)}" aria-label="Copy category ${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="bio">${esc(p.fields.bio || '')}<button class="copy tiny always" data-action="copy-model" data-source="generator" data-field="bio" aria-label="Copy bio">${I.copy}</button></p><div class="demo-meta"><button class="pill tiny" data-action="copy" data-copy="${esc(LOCALES[p.country]?.name.en || p.country)}" aria-label="Copy profile country">${esc(LOCALES[p.country]?.name.en || p.country)}</button> · <button class="pill tiny" data-action="copy" data-copy="${esc(p.type)}" aria-label="Copy profile type">${esc(p.type)}</button><br>Saved locally</div></div><div class="demo-right"><div class="mini-head"><span class="t">Profile fields</span><span class="pill tiny">Saved locally</span></div><div class="fields">${primary
          .filter((k) => p.fieldOrder.includes(k))
          .map((k) => fieldHTML(k, p.fields[k]))
          .join(
            ''
          )}</div><details data-profile-extra><summary>More fields</summary><div class="fields">${extra.map((k) => fieldHTML(k, p.fields[k])).join('')}</div><button class="btn btn-quiet" data-action="copy-model" data-source="generator" data-card="true">Copy full set</button></details><div class="demo-note">${I.alert}<span>Synthetic profile · saved on this device.</span></div></div></article>`
      : `<div class="card empty"><div class="orb">DEMO</div><h3>No demo set yet</h3><p>Pick a country and profile type, then Generate.</p></div>`
}
${newsBlockHTML()}</div>`;
}
