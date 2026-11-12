import {state} from '../state.js';
import {esc} from '../utils/dom.js';
import {LOCALES} from '../data/locales.js';
export function settingsHTML(){const s=state.settings;return `<div class="page"><div class="page-head"><div><div class="eyebrow">Local preferences</div><h1>Settings</h1><p class="sub">Changes apply to the next generated set. Existing cards keep their original rules.</p></div></div>
<form id="settings-form" class="card pad">
<label class="fl">Default country<select class="input" name="country">${Object.keys(LOCALES).map(k=>`<option ${s.country===k?'selected':''}>${k}</option>`).join('')}</select></label>
<label class="fl">Default type<select class="input" name="type">${['model','tech','crypto'].map(k=>`<option ${s.type===k?'selected':''}>${k}</option>`).join('')}</select></label>
<label class="fl">Symbols / marks<input class="input" name="symbols" value="${esc(s.symbols||'')}"></label>
<label class="fl">Field order (comma separated)<input class="input" name="fieldOrder" value="${esc((s.fieldOrder||[]).join(','))}"></label>
<label class="fl">Disabled optional fields<input class="input" name="disabledFields" value="${esc((s.disabledFields||[]).join(','))}"></label>
<label class="fl">Allow repeats for finite optional fields<input class="input" name="allowRepeats" value="${esc((s.allowRepeats||[]).join(','))}"></label>
<p class="sub">Phone, email and handle always remain unique. Finite dictionaries can run out.</p>
<label class="fl">Local rule overrides (JSON: common, types, pairs)<textarea class="input" name="overrides" rows="5">${esc(JSON.stringify(s.overrides||{},null,2))}</textarea></label>
<p class="sub">Archive folder: ${esc(s.archiveRoot||'Application data / archives')}</p><button type="button" class="btn" data-action="archive-directory">Choose archive folder</button>
<label class="fl"><input type="checkbox" name="includeOriginal" ${s.includeOriginal?'checked':''}> Include original bytes in future ZIPs (off by default)</label>
<label class="fl"><input type="checkbox" name="proxyEnabled" ${s.proxyEnabled?'checked':''}> Enable manual network / proxy checks</label>
<label class="fl"><input type="checkbox" name="newsEnabled" ${s.newsEnabled?'checked':''}> Enable selected news sources</label>
<label class="fl">Refresh interval<select class="input" name="newsInterval">${[15,30,60,180].map(n=>`<option value="${n}" ${s.newsInterval===n?'selected':''}>${n} minutes</option>`).join('')}</select></label>
<label class="fl">News sources (JSON array: id, name, url, topic)<textarea class="input" name="newsSources" rows="4">${esc(JSON.stringify(s.newsSources||[],null,2))}</textarea></label>
<p class="sub">No sources are selected by default. Settings contain no passwords or API keys.</p>
<button class="btn btn-primary" type="submit">Save settings</button>
</form></div>`;}
export function readSettingsForm(form){const data=new FormData(form);const list=k=>String(data.get(k)||'').split(',').map(s=>s.trim()).filter(Boolean);return {country:data.get('country'),type:data.get('type'),symbols:data.get('symbols'),fieldOrder:list('fieldOrder'),disabledFields:list('disabledFields'),allowRepeats:list('allowRepeats'),overrides:JSON.parse(data.get('overrides')),includeOriginal:data.has('includeOriginal'),proxyEnabled:data.has('proxyEnabled'),newsEnabled:data.has('newsEnabled'),newsInterval:Number(data.get('newsInterval')),newsSources:JSON.parse(data.get('newsSources'))};}
