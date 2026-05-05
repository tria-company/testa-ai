import { configureWebhook, sendTextMessage, getInstanceOwnerNumber } from './evolution.service.js';
import { analyzePromptAndBuildPersona, generateNextMessage } from './openai.service.js';
import { generate as generateReport } from './report.service.js';
import { saveMessage, saveResponse, saveReport } from './database.service.js';
import { cleanupTestLead, isValidProject } from './projects.service.js';
import { broadcast } from '../utils/sse.js';
import { startTimer, elapsed } from '../utils/timer.js';
import { retryWithBackoff } from '../utils/retry.js';

const RESPONSE_TIMEOUT_MS = 180000; // 3 minutos — agente baseline ~60s; 3min cobre picos sem segurar o teste demais
const MIN_DELAY_BETWEEN_MESSAGES_MS = 500; // anti-spam mínimo
const SESSION_MAX_DURATION_MS = 1500000; // 25 min — força finalização para o orquestrador receber report antes do timeout dele (30 min)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return 200 + Math.random() * 800; // 0.2-1.0s — tester rápido
}

export async function begin(session) {
  try {
    // Cap global de duração: força finalização antes do orquestrador desistir.
    session.maxDurationTimer = setTimeout(() => {
      handleSessionMaxDuration(session);
    }, SESSION_MAX_DURATION_MS);

    // 1. Configura webhook
    session.status = 'configuring_webhook';
    broadcast(session, 'status', { status: session.status });

    await configureWebhook(session);

    // 2. Gera persona do cliente
    session.status = 'running';
    broadcast(session, 'status', { status: session.status, message: 'Analisando prompt e gerando persona...' });

    const personaResult = await retryWithBackoff(
      () => analyzePromptAndBuildPersona(
        session.config.openaiApiKey,
        session.config.agentPrompt,
        session.config.customScenario
      ),
      { label: `openai.analyzePromptAndBuildPersona[session=${session.id}]` }
    );

    // Novo formato retorna estrutura aninhada — mapear para o formato plano esperado por generateNextMessage
    const p = personaResult.persona || personaResult;
    const analise = personaResult.analise_do_prompt || {};
    const cenarios = personaResult.cenarios_de_teste || {};

    session.persona = {
      ...p,
      businessType:        analise.businessType        || p.businessType,
      agentRole:           analise.agentRole           || p.agentRole,
      expectedFlow:        analise.expectedFlow         || p.expectedFlow        || [],
      agentLimitations:    analise.agentLimitations     || p.agentLimitations    || [],
      edgeCases: [
        ...(cenarios.alucinacao    || []).map((c) => `ALUCINAÇÃO: ${c.pergunta}`),
        ...(cenarios.limites       || []).map((c) => `LIMITES: ${c.pedido}`),
        ...(cenarios.fora_de_contexto || []).map((c) => `FORA DE CONTEXTO: ${c.mudanca_de_assunto}`),
        ...(cenarios.pressao       || []).map((c) => `PRESSÃO: ${c.tatica}`),
      ],
      memorySeeds: (cenarios.memoria || []).map((m) => ({
        info:          m.info_plantada,
        checkQuestion: m.momento_de_cobranca,
      })),
      hallucinationTraps: (cenarios.alucinacao || []).map((c) => c.pergunta),
      _fullAnalysis: personaResult,
    };

    broadcast(session, 'persona', { persona: session.persona });

    // 3. Envia primeira mensagem
    await sendNextMessage(session);
  } catch (err) {
    session.status = 'error';
    session.error = err.message;
    broadcast(session, 'error', { message: err.message });
    runProjectCleanup(session);
    throw err;
  }
}

async function sendNextMessage(session) {
  try {
    const messageIndex = session.config.messageCount - session.messagesRemaining;

    // Gera mensagem via GPT-4.1 (com retry em erros transitórios)
    const messageText = await retryWithBackoff(
      () => generateNextMessage(
        session.config.openaiApiKey,
        session.persona,
        session.conversation,
        messageIndex,
        session.config.messageCount
      ),
      { label: `openai.generateNextMessage[session=${session.id} msg=${messageIndex + 1}]` }
    );

    // Registra timestamp de envio
    const sentAt = startTimer();

    // Envia via Evolution API (apenas 1 retry pra mitigar risco de mensagem duplicada no WhatsApp)
    await retryWithBackoff(
      () => sendTextMessage(session, messageText),
      { retries: 1, label: `evolution.sendTextMessage[session=${session.id} msg=${messageIndex + 1}]` }
    );

    // Registra na conversa
    const testerMessage = {
      role: 'tester',
      content: messageText,
      timestamp: sentAt,
    };
    session.conversation.push(testerMessage);
    session.messagesRemaining--;

    console.log(`[Conversation] Tester enviou msg ${messageIndex + 1}/${session.config.messageCount} | restantes: ${session.messagesRemaining}`);

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

    // Timeout de 4 minutos para resposta
    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    session.timeoutTimer = setTimeout(() => {
      handleTimeout(session);
    }, RESPONSE_TIMEOUT_MS);
  } catch (err) {
    session.status = 'error';
    session.error = err.message;
    broadcast(session, 'error', { message: `Erro ao enviar mensagem: ${err.message}` });
    runProjectCleanup(session);
  }
}

function handleSessionMaxDuration(session) {
  // Acionado quando a sessão passa do cap global. Força finalização para o
  // orquestrador receber o relatório antes de seu próprio timeout.
  if (session.status === 'completed' || session.status === 'stopped' || session.status === 'error') return;

  console.warn(`[Session ${session.id}] Cap global de ${SESSION_MAX_DURATION_MS / 1000}s atingido — forçando finalização.`);

  // Limpa todos os timers
  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  if (session.multiMessageTimer) clearTimeout(session.multiMessageTimer);
  if (session.multiMessageMaxTimer) clearTimeout(session.multiMessageMaxTimer);

  // Marca pendente como resolvido
  if (session.pendingResponse && !session.pendingResponse.resolved) {
    session.pendingResponse.resolved = true;
  }

  session.maxDurationReached = true;
  broadcast(session, 'status', {
    status: session.status,
    message: `Cap global de ${Math.round(SESSION_MAX_DURATION_MS / 60000)}min atingido — gerando relatório com o que foi coletado.`,
  });

  // Tenta gerar relatório com o que tem; se não tiver mensagens suficientes, marca stopped.
  const agentMessages = session.conversation.filter((m) => m.role === 'agent').length;
  if (agentMessages >= 2) {
    finishTest(session);
  } else {
    session.status = 'stopped';
    session.error = 'Cap global de duração atingido sem conversa suficiente para relatório.';
    broadcast(session, 'status', { status: 'stopped', message: session.error });
    runProjectCleanup(session);
  }
}

function handleTimeout(session) {
  if (session.pendingResponse && !session.pendingResponse.resolved) {
    // Registra timeout como resposta do agente
    const timeoutMessage = {
      role: 'agent',
      content: '[TIMEOUT - Agente não respondeu em 3 minutos]',
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

  // Salvar mensagem do agente no banco de dados
  const savedMessage = await saveMessage(session.id, 'agent', text).catch((err) => {
    console.error('[Database] Erro ao salvar mensagem do agente:', err.message);
    return null;
  });

  // Salvar resposta com referência à mensagem
  if (savedMessage?.id) {
    saveResponse(session.id, savedMessage.id, text, {
      responseTimeMs,
      model: 'agent',
    }).catch((err) => console.error('[Database] Erro ao salvar resposta:', err.message));
  }

  broadcast(session, 'message', {
    ...agentMessage,
    messagesRemaining: session.messagesRemaining,
  });

  // Continua ou finaliza
  if (session.messagesRemaining > 0) {
    console.log(`[Conversation] Agente respondeu | restantes: ${session.messagesRemaining} → enviando próxima`);
    const delay = Math.max(MIN_DELAY_BETWEEN_MESSAGES_MS, randomDelay());
    await sleep(delay);
    await sendNextMessage(session);
  } else {
    console.log(`[Conversation] Agente respondeu | restantes: 0 → finalizando teste`);
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
  if (session.maxDurationTimer) {
    clearTimeout(session.maxDurationTimer);
    session.maxDurationTimer = null;
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
    runProjectCleanup(session);
  }
}

async function finishTest(session) {
  // Limpa o cap global — vamos finalizar agora.
  if (session.maxDurationTimer) {
    clearTimeout(session.maxDurationTimer);
    session.maxDurationTimer = null;
  }
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
  } finally {
    runProjectCleanup(session);
  }
}

// Apaga lead/threads no banco do projeto cliente após teste terminar.
// Best-effort: nunca quebra o fluxo do teste.
function runProjectCleanup(session) {
  const project = session?.config?.project;
  if (!project || !isValidProject(project)) return;
  if (session._cleanupRan) return;
  session._cleanupRan = true;

  (async () => {
    try {
      const testerPhone = await getInstanceOwnerNumber(session);
      if (!testerPhone) {
        console.warn(`[ProjectCleanup] Não foi possível obter o número da instância "${session.config.evolutionInstanceName}" — pulando.`);
        return;
      }
      await cleanupTestLead(project, testerPhone);
    } catch (err) {
      console.error(`[ProjectCleanup] Erro inesperado em runProjectCleanup (sessão ${session.id}):`, err.message);
    }
  })();
}
