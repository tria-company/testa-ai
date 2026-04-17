import { configureWebhook, sendTextMessage } from './evolution.service.js';
import { analyzePromptAndBuildPersona, generateNextMessage } from './openai.service.js';
import { generate as generateReport } from './report.service.js';
import { saveMessage, saveResponse, saveReport, updateSessionStatus } from './database.service.js';
import { broadcast } from '../utils/sse.js';
import { startTimer, elapsed } from '../utils/timer.js';

const RESPONSE_TIMEOUT_MS = 120000; // 2 minutos
const MIN_DELAY_BETWEEN_MESSAGES_MS = 2000; // anti-spam

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return 1000 + Math.random() * 2000; // 1-3s para simular digitação humana
}

export async function begin(session) {
  try {
    // 1. Configura webhook
    session.status = 'configuring_webhook';
    broadcast(session, 'status', { status: session.status });

    await configureWebhook(session);

    // 2. Gera persona do cliente
    session.status = 'running';
    broadcast(session, 'status', { status: session.status, message: 'Analisando prompt e gerando persona...' });

    session.persona = await analyzePromptAndBuildPersona(
      session.config.openaiApiKey,
      session.config.agentPrompt,
      session.config.customScenario
    );

    broadcast(session, 'persona', { persona: session.persona });

    // 3. Envia primeira mensagem
    await sendNextMessage(session);
  } catch (err) {
    session.status = 'error';
    session.error = err.message;
    broadcast(session, 'error', { message: err.message });
    throw err;
  }
}

async function sendNextMessage(session) {
  try {
    const messageIndex = session.config.messageCount - session.messagesRemaining;

    // Gera mensagem via GPT-4.1
    const messageText = await generateNextMessage(
      session.config.openaiApiKey,
      session.persona,
      session.conversation,
      messageIndex,
      session.config.messageCount
    );

    // Registra timestamp de envio
    const sentAt = startTimer();

    // Envia via Evolution API
    await sendTextMessage(session, messageText);

    // Registra na conversa
    const testerMessage = {
      role: 'tester',
      content: messageText,
      timestamp: sentAt,
    };
    session.conversation.push(testerMessage);
    session.messagesRemaining--;

    // Salvar mensagem no banco de dados
    saveMessage(session.id, 'tester', messageText).catch((err) =>
      console.error('[Database] Erro ao salvar mensagem:', err.message)
    );

    // Configura pending response
    session.pendingResponse = { sentAt, resolved: false };

    broadcast(session, 'message', {
      ...testerMessage,
      messagesRemaining: session.messagesRemaining,
    });

    // Timeout de 120s para resposta
    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    session.timeoutTimer = setTimeout(() => {
      handleTimeout(session);
    }, RESPONSE_TIMEOUT_MS);
  } catch (err) {
    session.status = 'error';
    session.error = err.message;
    broadcast(session, 'error', { message: `Erro ao enviar mensagem: ${err.message}` });
  }
}

function handleTimeout(session) {
  if (session.pendingResponse && !session.pendingResponse.resolved) {
    // Registra timeout como resposta do agente
    const timeoutMessage = {
      role: 'agent',
      content: '[TIMEOUT - Agente não respondeu em 120s]',
      timestamp: Date.now(),
      responseTimeMs: RESPONSE_TIMEOUT_MS,
      timeout: true,
    };
    session.conversation.push(timeoutMessage);
    session.pendingResponse.resolved = true;

    broadcast(session, 'message', {
      ...timeoutMessage,
      messagesRemaining: session.messagesRemaining,
    });

    // Continua ou finaliza
    if (session.messagesRemaining > 0) {
      sleep(MIN_DELAY_BETWEEN_MESSAGES_MS).then(() => sendNextMessage(session));
    } else {
      finishTest(session);
    }
  }
}

export async function handleAgentResponse(session, text) {
  if (!session.pendingResponse || session.pendingResponse.resolved) return;

  // Limpa timeout
  if (session.timeoutTimer) {
    clearTimeout(session.timeoutTimer);
    session.timeoutTimer = null;
  }

  const responseTimeMs = elapsed(session.pendingResponse.sentAt);
  session.pendingResponse.resolved = true;

  // Registra resposta do agente
  const agentMessage = {
    role: 'agent',
    content: text,
    timestamp: Date.now(),
    responseTimeMs,
  };
  session.conversation.push(agentMessage);

  // Salvar resposta no banco de dados
  saveResponse(session.id, null, text, {
    responseTimeMs,
    model: 'agent',
  }).catch((err) => console.error('[Database] Erro ao salvar resposta:', err.message));

  broadcast(session, 'message', {
    ...agentMessage,
    messagesRemaining: session.messagesRemaining,
  });

  // Continua ou finaliza
  if (session.messagesRemaining > 0) {
    const delay = Math.max(MIN_DELAY_BETWEEN_MESSAGES_MS, randomDelay());
    await sleep(delay);
    await sendNextMessage(session);
  } else {
    await finishTest(session);
  }
}

export async function stopTest(session) {
  // Limpa todos os timers
  if (session.timeoutTimer) {
    clearTimeout(session.timeoutTimer);
    session.timeoutTimer = null;
  }
  if (session.multiMessageTimer) {
    clearTimeout(session.multiMessageTimer);
    session.multiMessageTimer = null;
  }
  if (session.multiMessageMaxTimer) {
    clearTimeout(session.multiMessageMaxTimer);
    session.multiMessageMaxTimer = null;
  }

  // Marca resposta pendente como resolvida
  if (session.pendingResponse && !session.pendingResponse.resolved) {
    session.pendingResponse.resolved = true;
  }

  // Se tem conversa suficiente, gera relatório parcial
  const agentMessages = session.conversation.filter((m) => m.role === 'agent').length;
  if (agentMessages >= 2) {
    await finishTest(session);
  } else {
    session.status = 'stopped';
    broadcast(session, 'status', { status: 'stopped', message: 'Teste parado pelo usuário.' });
  }
}

async function finishTest(session) {
  try {
    session.status = 'generating_report';
    broadcast(session, 'status', { status: session.status, message: 'Gerando relatório...' });

    session.report = await generateReport(session);

    // Salvar relatório no banco de dados
    saveReport(session.id, session.report).catch((err) =>
      console.error('[Database] Erro ao salvar relatório:', err.message)
    );

    session.status = 'completed';
    broadcast(session, 'status', { status: session.status });
    broadcast(session, 'report', { report: session.report });
  } catch (err) {
    session.status = 'error';
    session.error = err.message;
    broadcast(session, 'error', { message: `Erro ao gerar relatório: ${err.message}` });
  }
}
