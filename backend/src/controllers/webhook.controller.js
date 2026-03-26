import { getSessionByAgentNumber } from '../models/session.js';
import { handleAgentResponse } from '../services/conversation.service.js';

// Tempo máximo para esperar todas as mensagens do agente (30s)
const MULTI_MSG_WAIT_MS = 30000;
// Tempo de inatividade para considerar que o agente terminou de responder (8s sem nova msg)
const MULTI_MSG_IDLE_MS = 8000;

export function handleEvent(req, res) {
  res.status(200).json({ received: true });

  const body = req.body;

  if (!body?.data?.key || !body?.data?.message) return;
  if (body.data.key.fromMe) return;

  const remoteJid = body.data.key.remoteJid || '';
  const messageId = body.data.key.id;
  const senderNumber = remoteJid.replace(/@.*$/, '');

  const session = getSessionByAgentNumber(senderNumber);
  if (!session) return;
  if (session.status !== 'running') return;

  // Deduplicação
  if (session.processedMessageIds.has(messageId)) return;
  session.processedMessageIds.add(messageId);

  // Extrai texto
  const text =
    body.data.message?.conversation ||
    body.data.message?.extendedTextMessage?.text ||
    body.data.message?.imageMessage?.caption ||
    body.data.message?.videoMessage?.caption ||
    '';

  if (!text) return;

  console.log(`[Webhook] Msg recebida de ${senderNumber}: "${text.substring(0, 80)}..." (buffer: ${session.multiMessageBuffer.length + 1})`);

  // Adiciona ao buffer
  session.multiMessageBuffer.push(text);

  // Limpa o timer de inatividade (idle) - cada nova msg reseta
  if (session.multiMessageTimer) {
    clearTimeout(session.multiMessageTimer);
  }

  // Timer de INATIVIDADE: se passar 8s sem nova mensagem, consolida
  session.multiMessageTimer = setTimeout(() => {
    flushBuffer(session);
  }, MULTI_MSG_IDLE_MS);

  // Timer MÁXIMO: na primeira msg do buffer, agenda um limite de 30s
  if (!session.multiMessageMaxTimer) {
    session.multiMessageMaxTimer = setTimeout(() => {
      flushBuffer(session);
    }, MULTI_MSG_WAIT_MS);
  }
}

function flushBuffer(session) {
  // Limpa ambos os timers
  if (session.multiMessageTimer) {
    clearTimeout(session.multiMessageTimer);
    session.multiMessageTimer = null;
  }
  if (session.multiMessageMaxTimer) {
    clearTimeout(session.multiMessageMaxTimer);
    session.multiMessageMaxTimer = null;
  }

  if (session.multiMessageBuffer.length === 0) return;

  const fullResponse = session.multiMessageBuffer.join('\n\n');
  const msgCount = session.multiMessageBuffer.length;
  session.multiMessageBuffer = [];

  console.log(`[Webhook] Consolidando ${msgCount} msg(s) do agente → respondendo`);
  handleAgentResponse(session, fullResponse);
}
