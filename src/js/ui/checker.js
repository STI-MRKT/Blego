import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
export const facebookLabels = {
  profile_visible: 'Public page available', login_required: 'Login required',
  unavailable: 'Page unavailable for this request', challenge_required: 'Check restricted',
  request_limited: 'Check restricted', network_error: 'Connection error',
  unsupported_target: 'Insufficient data', unknown: 'Insufficient data', cancelled: 'Cancelled'
};
const reasons = {
 LOGIN_REQUIRED:'Facebook asks you to sign in.', REQUEST_LIMITED:'Facebook has limited these requests.',
 CHECKER_CHALLENGE:'Facebook requires an additional check.', QUEUE_PAUSED:'Remaining checks paused by Facebook.',
 HTTP_403:'Facebook refused this request.',HTTP_404:'This page was not found.',HTTP_410:'This page is no longer available.',
 PAGE_UNAVAILABLE_MESSAGE:'Facebook returned an unavailable-page message.', NETWORK_FAILURE:'Could not connect to Facebook.',
 FB_TIMEOUT:'Facebook did not respond in time.', INSUFFICIENT_EVIDENCE:'The response does not identify a public profile.'
};
export function checkerHTML() {
 const {input='',rows,checking,notesOpen,cancelled}=state.checker;
 const copy=(label,value)=>`<button class="copy tiny always" data-action="copy" data-copy="${esc(value)}" aria-label="${label}">${I.copy}</button>`;
 return `<div class="page"><div class="page-head"><div><div class="eyebrow">TOOLS</div><h1>Checker</h1><p class="sub">Check public Facebook pages. Public availability does not confirm account restrictions.</p></div></div>
 <div class="card pad checker-card"><label class="fl" for="checker-input">IDs or profile links — one per line</label><textarea class="input checker-input" id="checker-input" spellcheck="false" placeholder="Profile ID or https://www.facebook.com/…" ${checking?'disabled':''}>${esc(input)}</textarea><div class="checker-actions"><span class="faint" id="checker-count">${input.split(/\r?\n/).filter(x=>x.trim()).length} rows</span><span style="flex:1"></span><button class="btn btn-quiet" data-action="checker-clear">Clear</button>${checking?'<button class="btn btn-quiet" data-action="checker-cancel">Cancel</button>':''}<button class="btn btn-primary" data-action="checker-run" ${!input.trim()||checking?'disabled':''}>${I.check}${checking?'Checking…':'Check'}</button></div></div>
 ${checking?`<div class="card pad checker-summary" id="checker-progress-card"><div class="checker-progress-head"><span class="spinner"></span><span id="checker-progress-text">Checking ${checking.done} of ${checking.total}</span></div><div class="checker-bar"><i id="checker-progress-fill" style="width:${checking.total?100*checking.done/checking.total:0}%"></i></div></div>`:''}
 ${cancelled?'<p class="sub">Cancelled</p>':''}
 ${rows?`<p class="sub" data-checker-stale ${state.checker.checkedInput===input?'hidden':''}>Previous input — check again after editing.</p><div class="table-wrap checker-table"><table class="tbl"><thead><tr><th>#</th><th>ID</th><th>Result</th><th>Profile link</th></tr></thead><tbody>${rows.map((row,index)=>{
 const label=row.check?(facebookLabels[row.check.availability]||facebookLabels.unknown):row.link?'Not checked':'Invalid input';
 const reason=row.check?(reasons[row.check.reasonCode]||''):row.link?'':'Enter a profile ID or direct profile link.';
 return `<tr class="checker-row" style="animation-delay:${Math.min(index*12,600)}ms"><td class="num">${index+1}</td><td><div class="cell-box"><span class="cell-val mono" data-action="cell-expand" title="${esc(row.id)}">${esc(row.id)}</span><button class="copy tiny always" data-action="copy-model" data-source="checker" data-row="${index}" data-field="id" aria-label="Copy Facebook ID">${I.copy}</button></div></td><td><div class="cell-box"><span class="pill">${esc(label)}</span>${copy('Copy check result',label)}</div>${reason?`<div class="cell-box"><span class="faint">${esc(reason)}</span>${copy('Copy uncertainty reason',reason)}</div>`:''}</td><td>${row.link?`<div class="checker-link"><a class="mono" href="${esc(row.link)}" target="_blank" rel="noreferrer noopener">${esc(row.link.replace('https://www.',''))}</a><button class="copy tiny always" data-action="copy-model" data-source="checker" data-row="${index}" data-field="link" aria-label="Copy Facebook link">${I.copy}</button></div>`:'—'}</td></tr>`;
 }).join('')}</tbody></table></div>
 <details id="facebook-details" ${notesOpen?'open':''}><summary>History and owner notes</summary><div data-facebook-notes><p class="sub">Account restrictions remain unknown. Owner reports are separate from public checks.</p>${rows.filter(row=>row.link).map(row=>{const index=rows.indexOf(row);return `<section class="card pad"><b>${esc(row.id)}</b>${row.check?.checkedAt?`<p>${esc(row.check.checkedAt)} ${copy('Copy check date',row.check.checkedAt)}</p>`:''}<label class="fl">Owner statement<select class="input" id="fb-note-status-${index}"><option value="not_checked">Not checked by owner</option><option value="blocked">Owner reports a block</option><option value="not_blocked">Owner reports no block</option></select></label><input class="input" id="fb-note-comment-${index}" maxlength="2000" placeholder="Optional owner comment"><button class="btn" data-action="facebook-note" data-index="${index}">Save owner report</button><details><summary>${row.notes?.length||0} owner reports</summary>${(row.notes||[]).map(note=>`<p>${esc(note.reportedAt)} ${copy('Copy report date',note.reportedAt)} · ${esc(note.status)} ${copy('Copy owner statement',note.status)} · ${esc(note.comment)} ${copy('Copy owner comment',note.comment)}</p>`).join('')}</details></section>`;}).join('')}</div></details>`:''}</div>`;
}
