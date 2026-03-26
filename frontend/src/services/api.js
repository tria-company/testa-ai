import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export async function startTest(config) {
  const { data } = await api.post('/test/start', config);
  return data;
}

export function getStatusStreamUrl(sessionId) {
  return `/api/test/${sessionId}/status`;
}

export async function stopTest(sessionId) {
  const { data } = await api.post(`/test/${sessionId}/stop`);
  return data;
}

export async function getReport(sessionId) {
  const { data } = await api.get(`/test/${sessionId}/report`);
  return data;
}

export async function getTunnelInfo() {
  const { data } = await api.get('/tunnel');
  return data;
}
