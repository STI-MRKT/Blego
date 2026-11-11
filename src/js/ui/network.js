import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';
import { riskBreakdown, riskLabel } from '../services/network.js';

const offline = (value) => (value === null || value === undefined || value === '' ? '—' : value);

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
  const duration = state.network.running ? 1.6 : Math.max(0.9, Math.min(2.6, 22 / Math.max(mbps, 1)));
  return `<div class="packets" style="--dur:${duration.toFixed(2)}s">
    ${Array.from({ length: 8 }, (_, index) => `<i style="animation-delay:-${(index * duration / 8).toFixed(2)}s"></i>`).join('')}
  </div>`;
}

function pingBarsHTML() {
  const ping = state.network.ping;
  if (!ping || !ping.targets) return '';
  return `<div class="ping-bars">
    ${ping.targets.map((target) => {
      const width = target.ms === null ? 4 : Math.max(6, Math.min(100, (target.ms / 200) * 100));
      return `<div class="ping-row">
        <span>${esc(target.label)}</span>
        <div class="ping-track"><i style="width:${width}%" class="${target.ms === null ? 'dead' : ''}"></i></div>
        <b>${target.ms === null ? '—' : `${target.ms} ms`}</b>
      </div>`;
    }).join('')}
  </div>`;
}

function ipBlockHTML() {
  const ip = state.network.ip;
  if (!ip) {
    return `<div class="net-empty">${I.globe}<span>Run a test to see your exit IP, ISP and network flags.</span></div>`;
  }
  const flag = (active) => (active ? `<span class="pill err">yes</span>` : `<span class="pill ok">no</span>`);
  return `<div class="net-loc">
      <span class="cc">${esc(ip.countryCode || '—')}</span>
      <div><b>${esc(ip.country || 'Unknown')}</b><span>${esc(ip.city || '')}${ip.zip ? ` · ${esc(ip.zip)}` : ''}</span></div>
    </div>
    <div class="net-rows">
      <div><span>ISP</span><b>${esc(offline(ip.isp))}</b></div>
      <div><span>ASN</span><b class="mono">${esc(offline(ip.as))}</b></div>
      <div><span>Timezone</span><b>${esc(offline(ip.timezone))}</b></div>
      <div><span>Proxy</span>${flag(ip.proxy)}</div>
      <div><span>Hosting</span>${flag(ip.hosting)}</div>
      <div><span>Mobile</span>${flag(ip.mobile)}</div>
    </div>`;
}

function riskHTML(ip, latency) {
  if (!ip) return '';
  const { score, factors } = riskBreakdown(ip, latency);
  const label = riskLabel(score);
  const tone = score >= 70 ? 'err' : score >= 40 ? 'warn' : score >= 15 ? 'warn' : 'ok';
  return `<div class="risk">
    <div class="risk-head"><span>Fraud risk</span><b class="risk-score ${tone}">${score}<small>/100</small></b></div>
    <div class="risk-bar"><i class="${tone}" style="width:${score}%"></i></div>
    <div class="risk-label ${tone}">${label}</div>
    <div class="risk-factors">
      ${factors.length
        ? factors.map((factor) => `<span class="risk-chip">${esc(factor.label)} <b>+${factor.points}</b></span>`).join('')
        : '<span class="risk-chip clean">No risk signals detected</span>'}
    </div>
  </div>`;
}

function proxyHTML() {
  const proxy = state.network.proxy;
  const input = state.network.proxyInput;
  return `<section class="card pad proxy-card">
    <div class="mini-head"><span class="t">Proxy fraud check</span><span class="pill tiny">HEURISTIC</span></div>
    <div class="proxy-form">
      <input class="input mono" id="proxy-input" data-input="proxy" placeholder="host:port or http://user:pass@host:port" value="${esc(input)}">
      <button class="btn btn-primary" data-action="proxy-check" ${state.network.proxyLoading ? 'disabled' : ''}>
        ${state.network.proxyLoading ? '<span class="spinner"></span>' : I.shield}Check
      </button>
    </div>
    <p class="hint">Leave empty to test the direct connection. Checks exit IP, geo, ASN, proxy and hosting flags, then cross-checks the exit IP with proxycheck.io for a second opinion.</p>
    ${state.network.proxyError ? `<div class="banner err" style="margin:10px 0 0">${I.alert}<div>${esc(state.network.proxyError)}</div></div>` : ''}
    ${state.network.proxyLoading ? `<div class="proxy-loading"><div class="sk" style="height:54px"></div><div class="sk" style="height:12px;width:70%"></div></div>` : ''}
    ${proxy ? `<div class="proxy-result">
      <div class="proxy-grid">
        <div><span>Exit IP</span><b class="mono">${esc(offline(proxy.query))}</b></div>
        <div><span>Country</span><b>${esc(offline(proxy.country))}${proxy.countryCode ? ` · ${esc(proxy.countryCode)}` : ''}</b></div>
        <div><span>City</span><b>${esc(offline(proxy.city))}</b></div>
        <div><span>ISP</span><b>${esc(offline(proxy.isp))}</b></div>
        <div><span>ASN</span><b class="mono">${esc(offline(proxy.as))}</b></div>
        <div><span>Latency</span><b>${offline(proxy.latency)} ms</b></div>
      </div>
      <div class="proxy-flags">
        <span class="pill ${proxy.proxy ? 'err' : 'ok'}">Proxy ${proxy.proxy ? 'yes' : 'no'}</span>
        <span class="pill ${proxy.hosting ? 'err' : 'ok'}">Hosting ${proxy.hosting ? 'yes' : 'no'}</span>
        <span class="pill ${proxy.mobile ? 'ok' : ''}">Mobile ${proxy.mobile ? 'yes' : 'no'}</span>
      </div>
      ${proxy.verification ? `<div class="proxy-verify">
        <span class="pill ${proxy.verification.proxy ? 'err' : 'ok'}">proxycheck ${proxy.verification.proxy ? 'proxy' : 'clean'}</span>
        <span class="faint">${esc([proxy.verification.type, proxy.verification.provider].filter(Boolean).join(' · '))}</span>
      </div>` : ''}
      ${riskHTML(proxy, proxy.latency)}
    </div>` : ''}
  </section>`;
}

function interfacesHTML() {
  const info = state.network.info;
  if (!info) return `<section class="card pad iface-card"><div class="mini-head"><span class="t">Local interfaces</span></div><div class="net-empty small">${I.bolt}<span>Network interfaces load with the first test.</span></div></section>`;
  return `<section class="card pad iface-card">
    <div class="mini-head"><span class="t">Local interfaces</span><span class="pill tiny">${esc(info.hostname)}</span></div>
    <div class="iface-list">
      ${info.interfaces.length ? info.interfaces.map((entry) => `<div class="iface-row">
        <div><b>${esc(entry.name)}</b><span class="mono">${esc(entry.address)} · ${esc(entry.mac)}</span></div>
        <span class="pill">IPv4</span>
      </div>`).join('') : '<div class="net-empty small">No active IPv4 interfaces</div>'}
    </div>
    <div class="iface-foot">${esc(info.platform)} ${esc(info.release)} · uptime ${Math.floor(info.uptime / 3600)} h</div>
  </section>`;
}

export function networkHTML() {
  const network = state.network;
  const speed = network.speed;
  const ping = network.ping;
  const status = network.running
    ? `<span class="pill accent"><span class="spinner"></span>${esc(network.stage || 'Testing')}</span>`
    : `<span class="pill">${network.ping ? 'Live' : 'Not tested'}</span>`;
  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">NETWORK</div><h1>Connection &amp; proxy</h1>
        <p class="sub">Local network diagnostics with a real speed test, latency probes and a transparent proxy risk score. Nothing leaves your machine except the test requests.</p></div>
      <div class="head-actions">
        <button class="btn btn-primary" data-action="net-run" ${network.running ? 'disabled' : ''}>${I.bolt}${network.running ? 'Testing…' : 'Run full test'}</button>
      </div>
    </div>
    <div class="net-grid">
      <section class="card net-hero">
        <div class="net-head"><span class="t">Throughput</span>${status}</div>
        ${gaugeHTML()}
        ${packetsHTML()}
        ${network.running ? '<div class="speed-progress"><i></i></div>' : ''}
        <div class="net-facts">
          <div><span>Ping</span><b>${ping && ping.best !== null ? `${ping.best} ms` : '—'}</b></div>
          <div><span>Jitter</span><b>${ping ? `${ping.jitter} ms` : '—'}</b></div>
          <div><span>Downloaded</span><b>${speed ? `${(speed.bytes / 1048576).toFixed(1)} MB` : '—'}</b></div>
          <div><span>TTFB</span><b>${speed ? `${speed.ttfb} ms` : '—'}</b></div>
        </div>
      </section>
      <section class="card net-side">
        <div class="mini-head"><span class="t">Exit node</span><span class="net-pulse" style="--p:${ping && ping.best ? Math.max(500, Math.min(2000, ping.best * 8)) : 1200}ms"><i></i><i></i><i></i></span></div>
        ${ipBlockHTML()}
        ${pingBarsHTML()}
        ${network.error ? `<div class="banner err" style="margin-top:12px">${I.alert}<div>${esc(network.error)}</div></div>` : ''}
      </section>
    </div>
    <div class="net-grid2">
      ${proxyHTML()}
      ${interfacesHTML()}
    </div>
  </div>`;
}
