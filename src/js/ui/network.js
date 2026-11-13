import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const valueText = (value) =>
  value === null || value === undefined || value === '' ? '—' : esc(String(value));
const msText = (value) => (Number.isFinite(value) ? `${Math.round(value)} ms` : '—');

function gaugeHTML() {
  const mbps = state.network.speed ? state.network.speed.mbps : 0;
  const scale = Math.max(50, Math.ceil(mbps / 50) * 50);
  const percent = Math.max(0, Math.min(100, (mbps / scale) * 100));
  const dash = 100 - percent;
  const testing = state.network.running || (state.network.proxyLoading && state.network.proxyFullTest);
  return `<div class="gauge-wrap ${testing ? 'is-testing' : ''}">
    <svg class="gauge" viewBox="0 0 240 140" aria-hidden="true">
      <defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b5bd6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
      <path class="gauge-track" d="M24 124a96 96 0 0 1 192 0"/>
      <path class="gauge-fill" d="M24 124a96 96 0 0 1 192 0" pathLength="100" stroke="url(#gaugeGrad)" style="--dash:${dash}"/>
      <path class="gauge-sweep" d="M24 124a96 96 0 0 1 192 0" pathLength="100" stroke="url(#gaugeGrad)"/>
    </svg>
    <div class="gauge-read"><b id="speed-value" data-value="${mbps}">${state.network.speed ? mbps : '—'}</b><span>Mbps</span></div>
  </div>`;
}

function packetsHTML() {
  const mbps = state.network.speed ? state.network.speed.mbps : 1;
  const duration = state.network.running
    ? 1.6
    : Math.max(0.9, Math.min(2.6, 22 / Math.max(mbps, 1)));
  return `<div class="packets" style="--dur:${duration.toFixed(2)}s">
    ${Array.from({ length: 8 }, (_, index) => `<i style="animation-delay:-${((index * duration) / 8).toFixed(2)}s"></i>`).join('')}
  </div>`;
}

const errorText = code => ({REQUEST_BLOCKED:'Request blocked',PROXY_AUTH_FAILED:'Proxy authentication failed',TIMEOUT:'Request timed out',DNS_FAILED:'DNS lookup failed',CANCELLED:'Check cancelled',TLS_FAILED:'TLS connection failed'})[code] || 'Network Error';
function scoreHTML(label, score, description) {
  const known=Number.isFinite(score)&&score>=0&&score<=100;
  return `<div class="risk" data-score="${known?score:'unknown'}"><div class="risk-head"><span>${label}</span><b class="risk-score">${known?`${score}<small>/100</small>`:'N/A'}</b></div><div class="quality-track ${known?'':'unknown'}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" ${known?`aria-valuenow="${score}"`:'aria-valuetext="Not available"'}><i style="width:${known?score:100}%;background-size:${known&&score>0?10000/score:100}% 100%"></i></div><p class="hint">${esc(description)}</p></div>`;
}
function scoresHTML(r) {
 const q=r?.quality,source=r?.sources?.find(s=>s.id==='proxycheck.io');
 return scoreHTML('Connection Quality',q?.score,q?`${q.successes||0}/${q.attempts||0} HTTPS requests · mean ${msText(q.meanMs)} · variation ${msText(q.jitterMs)}`:'Not measured')+
 scoreHTML('IP Trust',r?.assessment?.score,source?.status==='ok'?'proxycheck.io · 100 minus provider risk':source?({rate_limited:'Provider rate limit',auth_failed:'Provider access unavailable',timeout:'Provider timed out',invalid_response:'Incomplete provider response'})[source.status]||'Reputation unavailable':'Reputation not requested');
}
export function networkHTML() {
 const n=state.network,r=n.proxy,busy=n.proxyLoading||n.running;
 return `<div class="page"><div class="page-head"><div><h1>Network / Proxy</h1></div><div class="head-actions"><button class="btn" data-action="net-run" ${busy||!state.settings.proxyEnabled?'disabled':''}>Check Speed</button>${n.running?'<button class="btn" data-action="net-cancel">Cancel</button>':''}</div></div>
 ${!state.settings.proxyEnabled?'<div class="banner info"><span>Network checks are disabled.</span><button class="btn" data-action="net-enable">Enable checks</button></div>':''}
 <div class="net-grid"><section class="card net-hero lift"><div class="net-head"><span class="t">${n.speedRoute==='proxy'?'Proxy Speed':'Download Speed'}</span><span class="pill">${busy?'Testing…':'Mbps'}</span></div>${gaugeHTML()}${packetsHTML()}${busy?'<div class="speed-progress"><i></i></div>':''}<div class="net-facts"><div><span>Downloaded</span><b>${n.speed?`${(n.speed.bytes/1048576).toFixed(1)} MB`:'—'}</b></div><div><span>TTFB</span><b>${msText(n.speed?.ttfb)}</b></div></div>${n.error?`<p class="banner err">${esc(n.error)}</p>`:''}</section>
 <section class="card pad proxy-card"><div class="mini-head"><span class="t">Proxy</span><span class="pill tiny">HTTP / HTTPS / SOCKS5 / SOCKS5h</span></div><div class="proxy-form"><input class="input mono" id="proxy-input" data-input="proxy" type="text" autocomplete="off" aria-label="Proxy address" placeholder="host:port or socks5://user:pass@host:port" value="${esc(n.proxyInput||'')}" ${busy?'disabled':''}><button class="btn btn-primary" data-action="proxy-check" ${busy||!state.settings.proxyEnabled?'disabled':''}>${n.proxyLoading?'<span class="spinner"></span> Checking…':'Check Proxy'}</button></div>
 <label class="hint"><input type="checkbox" id="proxy-reputation" ${n.reputation?'checked':''} ${busy?'disabled':''}> Check IP Trust: send exit IP to proxycheck.io</label><div class="head-actions"><button class="btn" data-action="proxy-speed" ${busy||!state.settings.proxyEnabled?'disabled':''}>Check with Speed · 3 MB</button>${n.proxyLoading?'<button class="btn" data-action="proxy-cancel">Cancel</button>':''}</div>
 ${n.proxyError?`<p class="banner err">${esc(n.proxyError)}</p>`:''}
 ${r?`<div class="proxy-result"><div class="net-loc"><span class="cc">${r.connection==='ok'?'OK':'!'}</span><div><span>Connection Status</span><b>${r.connection==='ok'?'Connected':'Network Error'}</b><span>${r.code?errorText(r.code):''}</span></div></div><div class="net-rows"><div><span>Exit IP</span><b class="mono">${valueText(r.exitIp)}</b></div><div><span>Total time</span><b>${msText(r.timings?.totalMs)}</b></div></div>${r.rotatingIp?'<p class="hint">Exit IP changed during the check. Trust refers to the displayed IP.</p>':''}${r.speedError?'<p class="hint">Speed measurement unavailable.</p>':''}${scoresHTML(r)}</div>`:scoresHTML(null)}</section></div></div>`;
}
