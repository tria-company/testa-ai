import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || null,
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || '',
};

let _webhookUrl = config.webhookBaseUrl;

export function getWebhookUrl() {
  return _webhookUrl;
}

export function setWebhookUrl(url) {
  _webhookUrl = url;
}
