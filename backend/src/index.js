import express from 'express';
import cors from 'cors';
import ngrok from '@ngrok/ngrok';
import { config, setWebhookUrl, getWebhookUrl } from './config.js';
import testRoutes from './routes/test.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

const app = express();

app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use('/api/test', testRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/api/tunnel', (req, res) => {
  const url = getWebhookUrl();
  res.json({
    url,
    webhookEndpoint: url ? `${url}/api/webhook/evolution` : null,
    status: url ? 'connected' : 'connecting',
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => {
  console.log(`TestadorAI Backend rodando na porta ${config.port}`);

  if (config.webhookBaseUrl) {
    setWebhookUrl(config.webhookBaseUrl);
    console.log(`Webhook URL (manual): ${config.webhookBaseUrl}/api/webhook/evolution`);
    return;
  }

  startTunnel();
});

async function startTunnel() {
  try {
    console.log('\nCriando tunel ngrok...');
    const listener = await ngrok.forward({
      addr: config.port,
      authtoken: config.ngrokAuthToken || undefined,
    });

    const url = listener.url();
    setWebhookUrl(url);
    console.log(`\n  Ngrok ativo!`);
    console.log(`  URL publica: ${url}`);
    console.log(`  Webhook URL: ${url}/api/webhook/evolution\n`);
  } catch (err) {
    console.error('Erro ao criar tunel ngrok:', err.message);
    console.log('Configure NGROK_AUTH_TOKEN no .env (conta gratuita: https://dashboard.ngrok.com)\n');
  }
}
