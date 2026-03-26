import { v4 as uuidv4 } from 'uuid';

const sessions = new Map();
const sessionsByNumber = new Map();

export function createSession(configData) {
  const normalizedNumber = configData.agentWhatsappNumber.replace(/\D/g, '');

  // sessionsByNumber sempre aponta pro teste mais recente daquele número
  // (necessário para o webhook saber qual sessão responder)

  const session = {
    id: uuidv4(),
    status: 'pending',
    config: {
      ...configData,
      agentWhatsappNumber: normalizedNumber,
    },
    persona: null,
    conversation: [],
    pendingResponse: null,
    messagesRemaining: configData.messageCount,
    processedMessageIds: new Set(),
    multiMessageBuffer: [],
    multiMessageTimer: null,
    multiMessageMaxTimer: null,
    report: null,
    sseClients: [],
    timeoutTimer: null,
    createdAt: Date.now(),
  };

  sessions.set(session.id, session);
  sessionsByNumber.set(normalizedNumber, session);

  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function getSessionByAgentNumber(number) {
  const normalized = number.replace(/\D/g, '').replace(/@.*$/, '');
  return sessionsByNumber.get(normalized) || null;
}

export function removeSession(id) {
  const session = sessions.get(id);
  if (session) {
    sessionsByNumber.delete(session.config.agentWhatsappNumber);
    sessions.delete(id);
  }
}
