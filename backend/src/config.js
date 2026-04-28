import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || null,
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || '',
  apiKey: process.env.TESTA_AI_API_KEY || null,
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS, 10) || 6,
};

// Projetos cliente — cada um aponta para um Supabase próprio onde leads/threads são apagados
// após o teste. Adicione novos projetos aqui + variáveis de ambiente correspondentes.
export const PROJECTS = {
  'seu-elias': {
    label: 'Seu Elias',
    supabaseUrl: process.env.SEU_ELIAS_SUPABASE_URL,
    supabaseKey: process.env.SEU_ELIAS_SUPABASE_KEY,
  },
};

let _webhookUrl = config.webhookBaseUrl;

export function getWebhookUrl() {
  return _webhookUrl;
}

export function setWebhookUrl(url) {
  _webhookUrl = url;
}
