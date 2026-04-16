import { createSession, getSession, getAllSessions, removeSession } from '../models/session.js';
import { begin, stopTest as stopConversation } from '../services/conversation.service.js';
import { initSSE, broadcast } from '../utils/sse.js';

export async function startTest(req, res) {
  try {
    console.log('POST /api/test/start - body:', JSON.stringify(req.body, null, 2));

    const {
      agentWhatsappNumber,
      agentPrompt,
      messageCount,
      customScenario,
      externalRef,
      evolutionApiUrl,
      evolutionInstanceName,
      evolutionApiKey,
      openaiApiKey,
      caseData,
    } = req.body || {};

    const missing = [];
    if (!agentWhatsappNumber) missing.push('Numero do Agente');
    if (!agentPrompt) missing.push('Prompt do Agente');
    if (!messageCount) missing.push('Quantidade de Mensagens');
    if (!evolutionApiUrl) missing.push('URL da Evolution API');
    if (!evolutionInstanceName) missing.push('Nome da Instancia');
    if (!evolutionApiKey) missing.push('API Key da Evolution');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatorios: ${missing.join(', ')}` });
    }

    // Validação do customScenario (opcional, max 2000 chars)
    const scenarioValue = customScenario && typeof customScenario === 'string' ? customScenario.trim() : '';
    if (scenarioValue.length > 2000) {
      return res.status(400).json({ error: 'customScenario excede o limite de 2000 caracteres.' });
    }

    // Validação do externalRef (opcional, max 100 chars)
    const refValue = externalRef && typeof externalRef === 'string' ? externalRef.trim() : '';
    if (refValue.length > 100) {
      return res.status(400).json({ error: 'externalRef excede o limite de 100 caracteres.' });
    }

    // Validação do caseData (opcional, deve ser um objeto)
    let caseDataValue = null;
    let enhancedPrompt = agentPrompt;

    if (caseData) {
      if (typeof caseData !== 'object' || Array.isArray(caseData)) {
        return res.status(400).json({ error: 'caseData deve ser um objeto JSON.' });
      }
      caseDataValue = caseData;

      // Incorpora dados do caso no prompt (fonte da verdade - agente não deve inventar)
      const caseDataBlock = `\n\n╔════════════════════════════════════════════════════════════════╗
║           DADOS OFICIAIS DO CASO (FONTE DA VERDADE)            ║
║              Não invente, não altere, não adicione             ║
╚════════════════════════════════════════════════════════════════╝
${Object.entries(caseDataValue)
  .map(([key, value]) => `  ${key.padEnd(20)}: ${value}`)
  .join('\n')}
╔════════════════════════════════════════════════════════════════╗
REGRA CRÍTICA: Use EXATAMENTE estes dados. Se o cliente/pessoa
questionar algo fora destes dados, responda que você não tem
essa informação disponível ou que precisa verificar.
Você é responsável por não inventar ou alterar dados.
╚════════════════════════════════════════════════════════════════╝\n`;

      enhancedPrompt = agentPrompt + caseDataBlock;
    }

    const session = createSession({
      agentWhatsappNumber,
      agentPrompt: enhancedPrompt,
      messageCount: parseInt(messageCount, 10),
      customScenario: scenarioValue || null,
      externalRef: refValue || null,
      caseData: caseDataValue,
      evolutionApiUrl: evolutionApiUrl.replace(/\/+$/, ''),
      evolutionInstanceName,
      evolutionApiKey,
      openaiApiKey: openaiApiKey || process.env.OPENAI_API_KEY,
    });

    begin(session).catch((err) => {
      session.status = 'error';
      session.error = err.message;
      broadcast(session, 'error', { message: err.message });
    });

    return res.status(202).json({ sessionId: session.id, externalRef: session.config.externalRef || null });
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
    externalRef: session.config.externalRef || null,
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
  return res.json({ ...session.report, externalRef: session.config.externalRef || null });
}

export function listSessions(req, res) {
  const { status, externalRef } = req.query;

  let list = getAllSessions();

  if (status) {
    list = list.filter((s) => s.status === status);
  }
  if (externalRef) {
    list = list.filter((s) => s.config.externalRef === externalRef);
  }

  const sessions = list.map((s) => ({
    id: s.id,
    status: s.status,
    agentNumber: s.config.agentWhatsappNumber,
    externalRef: s.config.externalRef || null,
    messagesRemaining: s.messagesRemaining,
    createdAt: s.createdAt,
  }));

  return res.json({ sessions, total: sessions.length });
}
