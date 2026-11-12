import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
function gaugeHTML() {
  const mbps = state.network.speed ? state.network.speed.mbps : 0;
  const scale = Math.max(50, Math.ceil(mbps / 50) * 50);
  const percent = Math.max(0, Math.min(100, (mbps / scale) * 100));
  const dash = 100 - percent;
  const testing = state.network.running;
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

function pingBarsHTML() {
  const ping = state.network.ping;
  if (!ping || !ping.targets) return '';
  return `<div class="ping-bars">
    ${ping.targets
      .map((target) => {
        const width = target.ms === null ? 4 : Math.max(6, Math.min(100, (target.ms / 200) * 100));
        return `<div class="ping-row">
        <span>${esc(target.label)}</span>
        <div class="ping-track"><i style="width:${width}%" class="${target.ms === null ? 'dead' : ''}"></i></div>
        <b>${target.ms === null ? '—' : `${target.ms} ms`}</b>
      </div>`;
      })
      .join('')}
  </div>`;
}

const ms = (value) => (Number.isFinite(value) ? `${Math.round(value)} ms` : '—');
function valueHTML(label, value) {
  const text = value == null || value === '' ? '—' : String(value);
  return `<div><span>${esc(label)}</span><b>${esc(text)} ${text === '—' ? '' : `<button class="copy tiny" data-action="copy" data-copy="${esc(text)}" aria-label="Copy ${esc(label)}">${I.copy}</button>`}</b></div>`;
}
function trustHTML(result) {
  const score = result?.assessment?.trustScore;
  return `<div class="risk"><div class="risk-head"><span>IP Trust</span><b class="risk-score">${Number.isFinite(score) ? `${score}<small>/100</small>` : '—'}</b></div><div class="risk-bar"><i style="width:${Number.isFinite(score) ? score : 0}%"></i></div><p class="sub">${Number.isFinite(score) ? esc(result.assessment.trustSource) : 'Reputation data unavailable'}</p></div>`;
}
export function networkHTML() {
  const n = state.network,
    r = n.proxy,
    p = n.ping,
    s = n.speed;
  return `<div class="page"><div class="page-head"><div><div class="eyebrow">NETWORK</div><h1>Connection &amp; proxy</h1><p class="sub">Check a proxy or measure your direct connection.</p></div><div class="head-actions"><button class="btn btn-primary" data-action="net-run" ${n.running || !state.settings.proxyEnabled ? 'disabled' : ''}>${I.bolt}${n.running ? 'Testing…' : 'Measure direct connection'}</button></div></div>
<div class="net-grid"><section class="card net-hero"><div class="net-head"><span class="t">Throughput · direct</span><span class="pill">${n.running ? esc(n.stage) : s ? 'Measured' : 'Not tested'}</span></div>${gaugeHTML()}${packetsHTML()}${n.running ? '<div class="speed-progress"><i></i></div>' : ''}<div class="net-facts">${valueHTML('TCP latency', ms(p?.best))}${valueHTML('Spread', ms(p?.jitter))}${valueHTML('Downloaded', s ? `${(s.bytes / 1048576).toFixed(1)} MiB` : null)}${valueHTML('TTFB', ms(s?.ttfb))}</div></section>
<section class="card net-side"><div class="mini-head"><span class="t">Direct connection</span><span class="net-pulse" style="--p:1200ms"><i></i><i></i><i></i></span></div><div class="net-rows">${valueHTML('Exit IP', n.ip?.connection === 'ok' ? n.ip.exitIp : null)}${valueHTML('Average TCP latency', ms(p?.avg))}</div>${pingBarsHTML()}${n.error ? `<div class="banner err">${esc(n.error)}</div>` : ''}</section></div>
<div class="net-grid2"><section class="card pad proxy-card"><div class="mini-head"><span class="t">Proxy check</span><span class="pill tiny">HTTP · HTTPS · SOCKS5</span></div><div class="proxy-form"><input class="input mono" id="proxy-input" type="text" autocomplete="off" spellcheck="false" placeholder="host:port or protocol://user:password@host:port" value="${esc(n.proxyInput)}"><button class="btn btn-primary" data-action="proxy-check" ${n.proxyLoading || !state.settings.proxyEnabled ? 'disabled' : ''}>${I.shield}${n.proxyLoading ? 'Checking…' : 'Check'}</button>${n.proxyLoading ? '<button class="btn" data-action="proxy-cancel">Cancel</button>' : ''}</div>${!state.settings.proxyEnabled ? '<p class="sub">Network checks are off in Settings.</p>' : ''}${n.proxyError ? `<div class="banner err">${esc(n.proxyError)}</div>` : ''}${r ? `<div class="proxy-result"><div class="proxy-grid">${valueHTML('Exit IP', r.exitIp)}${valueHTML('Route', r.mode)}${valueHTML('Connection', ms(r.timings?.connectionMs))}${valueHTML('IP request', ms(r.timings?.ipRequestMs))}${valueHTML('Total', ms(r.timings?.totalMs))}</div>${r.connection !== 'ok' ? `<div class="banner err">${esc(r.code || 'Connection failed')}</div>` : trustHTML(r)}</div>` : ''}</section><section class="card pad iface-card"><div class="mini-head"><span class="t">Local interfaces</span></div>${n.info?.interfaces?.length ? `<div class="iface-list">${n.info.interfaces.map((i) => `<div class="iface-row"><b>${esc(i.name)}</b><span>${esc(i.address)} <button class="copy tiny" data-action="copy" data-copy="${esc(i.address)}" aria-label="Copy interface address">${I.copy}</button></span></div>`).join('')}</div>` : `<div class="net-empty small">${I.bolt}<span>Run a direct check to see active interfaces.</span></div>`}</section></div></div>`;
}
