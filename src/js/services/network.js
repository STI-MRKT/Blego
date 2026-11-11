async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const getNetworkInfo = () => getJson('/api/net/info');
export const getIpInfo = () => getJson('/api/net/ip');
export const getPing = () => getJson('/api/net/ping');
export const getSpeed = () => getJson('/api/net/speed');
export const checkProxy = (value) => getJson(`/api/proxy/check?proxy=${encodeURIComponent(value)}`);

export function riskBreakdown(ip, latency) {
  if (!ip) return { score: 0, factors: [] };
  const factors = [];
  if (ip.proxy) factors.push({ label: 'Proxy or VPN flagged', points: 40 });
  else if (ip.verification?.proxy) factors.push({ label: 'Proxycheck flags proxy', points: 35 });
  if (ip.verification?.type && /vpn/i.test(ip.verification.type)) factors.push({ label: 'VPN per proxycheck', points: 10 });
  if (ip.hosting) factors.push({ label: 'Datacenter or hosting IP', points: 25 });
  const org = `${ip.org || ''} ${ip.isp || ''} ${ip.as || ''}`.toLowerCase();
  if (!ip.hosting && /(amazon|aws|google|azure|microsoft|digitalocean|hetzner|ovh|linode|vultr|oracle|contabo|leaseweb)/.test(org)) {
    factors.push({ label: 'Cloud provider in ASN', points: 20 });
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (ip.timezone && timezone && ip.timezone !== timezone) factors.push({ label: 'Timezone mismatch', points: 10 });
  if (latency && latency > 350) factors.push({ label: 'High latency', points: 10 });
  if (!ip.mobile) factors.push({ label: 'Not a mobile network', points: 5 });
  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  return { score, factors };
}

export const riskLabel = (score) => {
  if (score >= 70) return 'High risk';
  if (score >= 40) return 'Elevated';
  if (score >= 15) return 'Moderate';
  return 'Low risk';
};
