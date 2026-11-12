import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { LOCALES } from '../data/locales.js';
import { newsBlockHTML } from './news.js';
import { profileText } from '../services/generator.js';
function fieldHTML(key, value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return `<div class="field"><div class="field-main"><div class="field-label">${esc(key)}</div><div class="field-value wrap">${esc(text)}</div></div><button class="copy" data-action="copy" data-copy="${esc(text)}" aria-label="Copy ${esc(key)}">${I.copy}</button></div>`;
}
export function ttlText() {
  return 'Saved locally';
}
export function generatorHTML() {
  const p = state.demo;
  const stats = state.poolStats;
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
<div class="ctl-hint">Female-name data · ${esc(stats?.datasetVersions?.country || 'loading')}. ${stats ? `${stats.counts.firstNames} names, ${stats.counts.lastNames} surnames. Limiting fields: ${esc(stats.limitingFields.join(', '))}; full-profile upper bound ${stats.fullProfileCapacity.upperBound} (estimate, other fields may exhaust earlier).` : ''} Optional repeats: ${state.settings.bulkMode ? 'multiple generation enabled with consent' : esc((state.settings.allowRepeats || []).join(', ') || 'none')}. Phone/email/handle remain unique. Some country vocabularies and postal data remain incomplete. See Settings for counts.</div>
<div class="ctl-actions"><button class="btn btn-quiet" data-action="clear-demo" ${p ? '' : 'disabled'}>Clear</button><button class="btn btn-primary" data-action="generate" ${state.demoBusy ? 'disabled' : ''}>${I.spark}${state.demoBusy ? 'Generating…' : 'Generate'}</button></div></div>
${p ? `<article class="card demo-card lift"><div class="demo-left"><div class="avatar xl">${esc(p.fields.name?.slice(0, 1) || 'B')}</div><div class="name">${esc(p.fields.name)}</div><div class="handle">${esc(p.fields.handle)}</div><p class="bio">${esc(p.fields.bio || '')}</p><div class="demo-meta">${esc(p.country)} · ${esc(p.type)}<br>${esc(p.createdAt)}<br>${esc(p.rulesVersion)}</div><button class="btn" data-action="copy" data-copy="${esc(profileText(p))}">Copy full set</button></div><div class="demo-right"><div class="mini-head"><span class="t">Profile fields</span><span class="pill tiny">Saved locally</span></div><div class="fields">${p.fieldOrder.map((k) => fieldHTML(k, p.fields[k])).join('')}</div><div class="demo-note">${I.alert}<span>Synthetic values. Phone format does not guarantee that a number has no real owner. No calls or messages are sent. Uniqueness applies to this installation’s saved history.</span></div></div></article>` : `<div class="card empty"><div class="orb">DEMO</div><h3>No set yet</h3><p>Select a country and type, then generate.</p></div>`}
${newsBlockHTML()}</div>`;
}
