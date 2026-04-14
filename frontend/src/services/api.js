import axios from 'axios';

const API_KEY = import.meta.env.VITE_TESTA_AI_API_KEY || null;

const api = axios.create({
  baseURL: '/api',
  ...(API_KEY && { headers: { Authorization: `Bearer ${API_KEY}` } }),
});

export async function startTest(config) {
  const { data } = await api.post('/test/start', config);
  return data;
}

export function getStatusStreamUrl(sessionId) {
  const base = `/api/test/${sessionId}/status`;
  return API_KEY ? `${base}?token=${encodeURIComponent(API_KEY)}` : base;
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
