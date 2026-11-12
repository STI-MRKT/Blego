import { state } from '../state.js';
import { I } from '../icons.js';
import { esc } from '../utils/dom.js';

const valueText = (value) => value === null || value === undefined || value === '' ? '—' : esc(String(value));
const msText = (value) => Number.isFinite(value) ? `${Math.round(value)} ms` : '—';



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
  if (!ping || !ping.targets) return '<div class="net-empty small">Узлы пока не проверены</div>';
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
  if (!ip) return `<div class="net-empty">${I.globe}<span>Нажмите «Пинг» или «Проверить сеть», чтобы увидеть IP и задержку.</span></div>`;
  if (ip.connection !== 'ok') return `<div class="net-empty small">${I.alert}<span>Внешний IP не определён. Пинг и скорость доступны независимо.</span></div>`;
  return `<div class="net-loc"><span class="cc">IP</span>
    <div><b class="mono">${valueText(ip.exitIp)}</b><span>Внешний адрес · прямое соединение</span></div></div>
    <div class="net-rows"><div><span>Подключение</span><b>${msText(ip.timings?.connectionMs)}</b></div>
      <div><span>Запрос IP</span><b>${msText(ip.timings?.ipRequestMs)}</b></div></div>`;
}

function riskHTML(result) {
  const a = result?.assessment;
  if (!a || !Number.isFinite(a.score)) {
    return `<div class="risk"><div class="risk-head"><span>Репутация IP</span><b>Нет данных</b></div>
      <p class="hint">Отсутствие ответа не означает низкий риск.</p></div>`;
  }
  const score = Math.max(0, Math.min(100, a.score));
  return `<div class="risk"><div class="risk-head"><span>Оценка по доступным признакам</span>
    <b class="risk-score warn">${score}<small>/100</small></b></div>
    <div class="risk-bar"><i class="warn" style="width:${score}%"></i></div>
    <p class="hint">Эвристика, не вероятность мошенничества. Пинг не влияет на оценку.</p>
    <div class="risk-factors">${(a.factors || []).map((f) => `<span class="risk-chip">${esc(String(f.flag || f.label || 'Признак'))}</span>`).join('')}</div></div>`;
}

function proxyHTML() {
  const n = state.network, r = n.proxy;
  return `<section class="card pad proxy-card">
    <div class="mini-head"><span class="t">Проверка прокси</span><span class="pill tiny">HTTP / HTTPS / SOCKS5</span></div>
    <div class="proxy-form">
      <input class="input mono" id="proxy-input" data-input="proxy" type="password" autocomplete="off"
        aria-label="Адрес прокси" placeholder="host:port или socks5://user:pass@host:port" value="${esc(n.proxyInput || '')}">
      <button class="btn btn-quiet" data-action="proxy-reveal" aria-label="Показать или скрыть адрес прокси" title="Показать / скрыть">Показать</button>
      <button class="btn btn-primary" data-action="proxy-check" ${n.proxyLoading || !state.settings.proxyEnabled ? 'disabled' : ''}>
        ${n.proxyLoading ? '<span class="spinner"></span> Проверяем…' : I.shield + ' Проверить'}</button>
    </div>
    <p class="hint">Пустое поле — прямое соединение. Пароли не включаются в отчёт.</p>
    ${n.proxyLoading ? '<div class="proxy-loading"><div class="sk" style="height:45px"></div><div class="sk" style="width:60%;height:12px"></div></div>' : ''}
    ${n.proxyError ? `<div class="banner err">${I.alert}<div>${esc(n.proxyError)}</div></div>` : ''}
    ${r ? `<div class="proxy-result">
      <div class="net-loc"><span class="cc">${r.connection === 'ok' ? 'OK' : '!'}</span>
        <div><b>${r.connection === 'ok' ? 'Соединение установлено' : 'Ошибка подключения'}</b>
          <span class="mono">${valueText(r.exitIp)} ${r.code ? '· ' + valueText(r.code) : ''}</span></div></div>
      <div class="proxy-grid">
        <div><span>Соединение</span><b>${msText(r.timings?.connectionMs)}</b></div>
        <div><span>IP-запрос</span><b>${msText(r.timings?.ipRequestMs)}</b></div>
        <div><span>Репутация</span><b>${msText(r.timings?.reputationMs)}</b></div>
        <div><span>Всего</span><b>${msText(r.timings?.totalMs)}</b></div>
      </div>
      ${riskHTML(r)}
      <details class="ux-details"><summary>Источники и технические сведения</summary>
        <p class="hint">${valueText(r.protocol)} · ${valueText(r.mode)} · ${valueText(r.checkedAt)}</p>
        <pre class="ux-json">${esc(JSON.stringify(r.sources || [], null, 2))}</pre></details>
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
      <div><div class="eyebrow">NETWORK</div><h1>Сеть и прокси</h1>
        <p class="sub">Пинг, скорость, внешний IP и прокси. Важное видно сразу, технические детали — по запросу.</p></div>
      <div class="head-actions">
        <button class="btn btn-quiet" data-action="net-ping" ${network.running || !state.settings.proxyEnabled ? 'disabled' : ''}>${I.bolt}Пинг</button>
        <button class="btn btn-primary" data-action="net-run" ${network.running || !state.settings.proxyEnabled ? 'disabled' : ''}>${I.bolt}${network.running ? 'Testing…' : 'Проверить сеть'}</button>
      </div>
    </div>
    ${!state.settings.proxyEnabled ? `<div class="banner info ux-permission">${I.shield}<div><b>Проверки сети выключены</b><p>Внешние запросы будут выполнены только после вашего нажатия.</p></div><button class="btn btn-primary" data-action="net-enable">Включить и измерить пинг</button></div>` : ''}
    <div class="net-grid">
      <section class="card net-hero lift">
        <div class="net-head"><span class="t">Скорость загрузки</span>${status}</div>
        ${gaugeHTML()}
        ${packetsHTML()}
        ${network.running ? '<div class="speed-progress"><i></i></div>' : ''}
        <div class="net-facts">
          <div><span>Пинг TCP</span><b>${ping && ping.best !== null ? `${ping.best} ms` : '—'}</b></div>
          <div><span>Разброс</span><b>${ping ? `${ping.jitter} ms` : '—'}</b></div>
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
        <p class="hint">Задержка измеряется при установлении TCP-соединения, а не ICMP.</p>
    </div>
    <div class="net-grid2">
      ${proxyHTML()}
      ${interfacesHTML()}
    </div>
  </div>`;
}
