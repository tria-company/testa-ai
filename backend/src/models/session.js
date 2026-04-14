import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

const sessions = new Map();
// Map<string, Session[]> — múltiplas sessões podem existir para o mesmo número
const sessionsByNumber = new Map();

const ACTIVE_STATUSES = new Set(['pending', 'configuring_webhook', 'running', 'generating_report']);
const TERMINAL_STATUSES = new Set(['completed', 'stopped', 'error']);

export function createSession(configData) {
  const normalizedNumber = configData.agentWhatsappNumber.replace(/\D/g, '');

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

  // Adiciona ao array de sessões desse número
  const existing = sessionsByNumber.get(normalizedNumber) || [];
  const activeCount = existing.filter((s) => ACTIVE_STATUSES.has(s.status)).length;
  if (activeCount > 0) {
    console.warn(`[Session] Atenção: já existe(m) ${activeCount} sessão(ões) ativa(s) para o número ${normalizedNumber}. Webhook vai rotear para a mais recente.`);
  }
  existing.push(session);
  sessionsByNumber.set(normalizedNumber, existing);

  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function getAllSessions() {
  return Array.from(sessions.values());
}

export function getSessionByAgentNumber(number) {
  const normalized = number.replace(/\D/g, '').replace(/@.*$/, '');
  const list = sessionsByNumber.get(normalized);
  if (!list || list.length === 0) return null;

  // Roteia para a sessão ativa mais recente (última do array que está ativa)
  for (let i = list.length - 1; i >= 0; i--) {
    if (ACTIVE_STATUSES.has(list[i].status)) {
      return list[i];
    }
  }
  return null;
}

export function removeSession(id) {
  const session = sessions.get(id);
  if (session) {
    const number = session.config.agentWhatsappNumber;
    const list = sessionsByNumber.get(number);
    if (list) {
      const filtered = list.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        sessionsByNumber.delete(number);
      } else {
        sessionsByNumber.set(number, filtered);
      }
    }
    sessions.delete(id);
  }
}

export function cleanupExpiredSessions() {
  const ttlMs = config.sessionTtlHours * 60 * 60 * 1000;
  const now = Date.now();

  // Coleta IDs primeiro para não modificar o Map durante iteração
  const toRemove = [];
  for (const [id, session] of sessions) {
    if (TERMINAL_STATUSES.has(session.status) && (now - session.createdAt) > ttlMs) {
      toRemove.push(id);
    }
  }

  for (const id of toRemove) {
    removeSession(id);
  }

  if (toRemove.length > 0) {
    console.log(`[Cleanup] ${toRemove.length} sessão(ões) expirada(s) removida(s).`);
  }
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

export function startCleanupJob() {
  setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
  console.log(`[Cleanup] Job iniciado — TTL: ${config.sessionTtlHours}h, intervalo: 10min.`);
}
