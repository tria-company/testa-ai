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
      const wrapped = new Error(`Evolution API [${status}]: ${data?.response?.message || data?.message || data?.error || err.message}`);
      wrapped.status = status;
      wrapped.code = err.code;
      wrapped.cause = err;
      throw wrapped;
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

  // 1. POST /webhook/set/{instance} — aplica config
  await client.post(`/webhook/set/${instanceName}`, {
    webhook: {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
      enabled: true,
    },
  });

  // 2. GET /webhook/find/{instance} — verifica que ficou correto
  let current;
  try {
    const found = await client.get(`/webhook/find/${instanceName}`);
    current = found.data;
  } catch (err) {
    throw new Error(`Falha ao verificar webhook da instancia "${instanceName}": ${err.message}`);
  }

  const actualUrl = current?.url || current?.webhook?.url;
  const actualEnabled = current?.enabled ?? current?.webhook?.enabled;
  const actualEvents = current?.events || current?.webhook?.events || [];
  const hasMessagesUpsert = Array.isArray(actualEvents) && actualEvents.includes('MESSAGES_UPSERT');

  if (actualUrl !== webhookUrl || actualEnabled !== true || !hasMessagesUpsert) {
    throw new Error(
      `Webhook da instancia "${instanceName}" nao ficou configurado corretamente. ` +
      `Esperado: url=${webhookUrl}, enabled=true, events inclui MESSAGES_UPSERT. ` +
      `Atual: url=${actualUrl}, enabled=${actualEnabled}, events=${JSON.stringify(actualEvents)}`
    );
  }

  console.log(`[Webhook] Configurado e validado para instancia "${instanceName}": ${webhookUrl}`);
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
