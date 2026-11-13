async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw Error('NETWORK_REQUEST_FAILED');
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const getNetworkInfo = () => getJson('/api/net/info');
export const getIpInfo = () => window.blego.checkProxy({ value: '' });
export const getPing = () => getJson('/api/net/ping');
export const getSpeed = () => getJson('/api/net/speed');
export const checkProxy = (value, options = {}) => window.blego.checkProxy({ value, ...options });
export function riskBreakdown(ip) {
  return ip?.assessment || { score: null, factors: [], status: 'insufficient_data' };
}
export const riskLabel = (score) =>
  score === null ? 'Insufficient data' : `IP Trust: ${score}`;
