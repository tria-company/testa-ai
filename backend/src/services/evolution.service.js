import axios from 'axios';
import { getWebhookUrl } from '../config.js';

function evoApi(session) {
  const { evolutionApiUrl, evolutionInstanceName, evolutionApiKey } = session.config;
  const client = axios.create({
    baseURL: evolutionApiUrl,
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionApiKey,
    },
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const data = err.response?.data;
      const status = err.response?.status;
      const url = err.config?.url;
      console.error(`Evolution API ERRO [${status}] ${url}:`, JSON.stringify(data, null, 2));
      throw new Error(`Evolution API [${status}]: ${data?.response?.message || data?.message || data?.error || err.message}`);
    }
  );

  return { client, instanceName: evolutionInstanceName };
}

export async function configureWebhook(session) {
  const baseUrl = getWebhookUrl();

  if (!baseUrl) {
    throw new Error('Webhook URL nao disponivel. Aguarde o tunel iniciar ou configure WEBHOOK_BASE_URL no .env');
  }

  const webhookUrl = `${baseUrl}/api/webhook/evolution`;
  const { client, instanceName } = evoApi(session);

  // Evolution API v2 - POST /webhook/set/{instance} com wrapper "webhook"
  await client.post(`/webhook/set/${instanceName}`, {
    webhook: {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
      enabled: true,
    },
  });

  console.log(`Webhook configurado: ${webhookUrl}`);
}

export async function sendTextMessage(session, text) {
  const { client, instanceName } = evoApi(session);

  const response = await client.post(`/message/sendText/${instanceName}`, {
    number: session.config.agentWhatsappNumber,
    text,
    delay: 1000,
  });

  return response.data;
}
