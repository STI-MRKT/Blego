import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

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

function ipBlockHTML() {
  const ip = state.network.ip;
  if (!ip)
    return `<div class="net-empty">${I.globe}<span>Нажмите «Проверить сеть», чтобы узнать внешний IP.</span></div>`;
  return ip.connection === 'ok'
    ? `<div class="net-loc"><span class="cc">IP</span>
      <div><b class="mono">${esc(ip.exitIp || '—')}</b><span>Внешний IP-адрес</span></div>
      </div><div class="net-rows">
      <div><span>Подключение</span><b>${Number.isFinite(ip.timings?.connectionMs) ? Math.round(ip.timings.connectionMs) + ' мс' : '—'}</b></div>
      <div><span>Ответ IP</span><b>${Number.isFinite(ip.timings?.ipRequestMs) ? Math.round(ip.timings.ipRequestMs) + ' мс' : '—'}</b></div>
      </div>`
    : `<div class="net-empty small">${I.alert}<span>Не удалось определить IP</span></div>`;
}

function riskHTML(ip) {
  const trust = ip?.assessment?.trustScore;
  const source = ip?.sources?.find((s) => s.id === ip.assessment?.trustSource && s.status === 'ok');
  if (!Number.isInteger(trust)) {
    return `<div class="risk"><div class="risk-head"><span>Траст IP</span><b class="risk-label warn">— / 100</b></div>
      <div class="risk-label">Нет подтверждённой оценки</div></div>`;
  }
  const tone = trust >= 75 ? 'ok' : trust >= 40 ? 'warn' : 'err';
  return `<div class="risk">
    <div class="risk-head"><span>Траст IP · proxycheck.io</span><b class="risk-score ${tone}">${trust}<small>/100</small></b></div>
    <div class="risk-bar"><i class="${tone}" style="width:${trust}%"></i></div>
    <div class="risk-factors">
      ${
        source
          ? [
              source.proxy ? 'Известный прокси' : 'Прокси не обнаружен',
              source.vpn ? 'VPN' : null,
              source.tor ? 'Tor' : null,
              source.hosting ? 'Серверный IP' : null,
              source.type ? source.type : null
            ]
              .filter(Boolean)
              .map((label) => `<span class="risk-chip">${esc(label)}</span>`)
              .join('')
          : ''
      }
    </div>
    <div class="risk-label">Условная оценка: 100 − риск источника; не гарантия доверия платформы.</div>
  </div>`;
}

function proxyHTML() {
  const n = state.network,
    proxy = n.proxy;
  return `<section class="card pad proxy-card">
    <div class="mini-head"><span class="t">Проверка прокси</span><span class="pill tiny">HTTP · HTTPS · SOCKS5</span></div>
    <div class="proxy-form">
      <input class="input mono" id="proxy-input" data-input="proxy" type="text" autocomplete="off"
        placeholder="host:port или socks5://user:password@host:port" aria-label="Proxy address" value="${esc(n.proxyInput || '')}">
      <button class="btn btn-primary" data-action="proxy-check" ${n.proxyLoading ? 'disabled' : ''}>${n.proxyLoading ? '<span class="spinner"></span>Проверка…' : I.shield + 'Проверить'}</button>
    </div>
    ${n.proxyError ? `<div class="banner err">${I.alert}<div>${esc(n.proxyError)}</div></div>` : ''}
    ${n.proxyLoading ? '<div class="proxy-loading"><div class="sk" style="height:52px"></div></div>' : ''}
    ${
      proxy
        ? `<div class="proxy-result">
      <div class="proxy-grid">
        <div><span>Внешний IP</span><b class="mono">${esc(proxy.exitIp || '—')}</b></div>
        <div><span>Соединение</span><b>${proxy.connection === 'ok' ? 'Работает' : 'Ошибка'}</b></div>
        <div><span>Время подключения</span><b>${Number.isFinite(proxy.timings?.connectionMs) ? Math.round(proxy.timings.connectionMs) + ' мс' : '—'}</b></div>
        <div><span>Ответ</span><b>${Number.isFinite(proxy.timings?.ipRequestMs) ? Math.round(proxy.timings.ipRequestMs) + ' мс' : '—'}</b></div>
      </div>
      ${riskHTML(proxy)}
    </div>`
        : ''
    }
  </section>`;
}

function interfacesHTML() {
  const info = state.network.info;
  if (!info)
    return `<section class="card pad iface-card"><div class="mini-head"><span class="t">Local interfaces</span></div><div class="net-empty small">${I.bolt}<span>Network interfaces load with the first test.</span></div></section>`;
  return `<section class="card pad iface-card">
    <div class="mini-head"><span class="t">Local interfaces</span><span class="pill tiny">${esc(info.hostname)}</span></div>
    <div class="iface-list">
      ${
        info.interfaces.length
          ? info.interfaces
              .map(
                (entry) => `<div class="iface-row">
        <div><b>${esc(entry.name)}</b><span class="mono">${esc(entry.address)} · ${esc(entry.mac)}</span></div>
        <span class="pill">IPv4</span>
      </div>`
              )
              .join('')
          : '<div class="net-empty small">No active IPv4 interfaces</div>'
      }
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
      <div><div class="eyebrow">NETWORK</div><h1>Сеть и прокси</h1>
        <p class="sub">Пинг, скорость и проверка прокси.</p></div>
      <div class="head-actions">
        <button class="btn btn-quiet" data-action="net-ping" ${network.running ? 'disabled' : ''}>Пинг</button><button class="btn btn-primary" data-action="net-run" ${network.running ? 'disabled' : ''}>${I.bolt}${network.running ? 'Testing…' : 'Проверить сеть'}</button>
      </div>
    </div>
    <div class="net-grid">
      <section class="card net-hero">
        <div class="net-head"><span class="t">Скорость</span>${status}</div>
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
        <div class="mini-head"><span class="t">Внешний адрес</span><span class="net-pulse" style="--p:${ping && ping.best ? Math.max(500, Math.min(2000, ping.best * 8)) : 1200}ms"><i></i><i></i><i></i></span></div>
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
