import { createSession, getSession, removeSession } from '../models/session.js';
import { begin, stopTest as stopConversation } from '../services/conversation.service.js';
import { initSSE, broadcast } from '../utils/sse.js';

export async function startTest(req, res) {
  try {
    console.log('POST /api/test/start - body:', JSON.stringify(req.body, null, 2));

    const {
      agentWhatsappNumber,
      agentPrompt,
      messageCount,
      evolutionApiUrl,
      evolutionInstanceName,
      evolutionApiKey,
      openaiApiKey,
    } = req.body || {};

    const missing = [];
    if (!agentWhatsappNumber) missing.push('Numero do Agente');
    if (!agentPrompt) missing.push('Prompt do Agente');
    if (!messageCount) missing.push('Quantidade de Mensagens');
    if (!evolutionApiUrl) missing.push('URL da Evolution API');
    if (!evolutionInstanceName) missing.push('Nome da Instancia');
    if (!evolutionApiKey) missing.push('API Key da Evolution');
    if (!openaiApiKey) missing.push('API Key da OpenAI');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatorios: ${missing.join(', ')}` });
    }

    const session = createSession({
      agentWhatsappNumber,
      agentPrompt,
      messageCount: parseInt(messageCount, 10),
      evolutionApiUrl: evolutionApiUrl.replace(/\/+$/, ''),
      evolutionInstanceName,
      evolutionApiKey,
      openaiApiKey,
    });

    begin(session).catch((err) => {
      session.status = 'error';
      session.error = err.message;
      broadcast(session, 'error', { message: err.message });
    });

    return res.status(202).json({ sessionId: session.id });
  } catch (err) {
    console.error('Erro ao iniciar teste:', err.message);
    return res.status(400).json({ error: err.message });
  }
}

export function streamStatus(req, res) {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }

  initSSE(res);
  session.sseClients.push(res);

  // Envia estado atual como snapshot inicial
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    status: session.status,
    conversation: session.conversation,
    report: session.report,
    messagesRemaining: session.messagesRemaining,
  })}\n\n`);

  req.on('close', () => {
    session.sseClients = session.sseClients.filter((c) => c !== res);
  });
}

export async function stopTest(req, res) {
  try {
    const session = getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (session.status !== 'running' && session.status !== 'configuring_webhook') {
      return res.status(400).json({ error: `Teste não está rodando (status: ${session.status}).` });
    }

    await stopConversation(session);

    return res.json({ message: 'Teste parado.', status: session.status, report: session.report || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export function getReport(req, res) {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }
  if (!session.report) {
    return res.status(404).json({ error: 'Relatório ainda não gerado.' });
  }
  return res.json(session.report);
}
