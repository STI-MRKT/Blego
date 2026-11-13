async function getJson(url, signal) {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw Error('NETWORK_REQUEST_FAILED');
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

export const getNetworkInfo = (signal) => getJson('/api/net/info', signal);
export const getIpInfo = () => window.blego.checkProxy({ value: '' });
export const getPing = (signal) => getJson('/api/net/ping', signal);
export const getSpeed = (signal) => getJson('/api/net/speed', signal);
export const checkProxy = (value, options = {}) => window.blego.checkProxy({ value, ...options });
export function riskBreakdown(ip) {
  return ip?.assessment || { score: null, factors: [], status: 'insufficient_data' };
}
export const riskLabel = (score) =>
  score === null ? 'Insufficient data' : `IP Trust: ${score}`;
