import { useState, useCallback } from 'react';
import TestForm from './components/TestForm';
import TunnelStatus from './components/TunnelStatus';
import SessionList from './components/SessionList';
import ActiveSession from './components/ActiveSession';
import { startTest } from './services/api';

export default function App() {
  const [sessions, setSessions] = useState([]); // { id, agentNumber, label, totalMessages, status }
  const [activeSessionId, setActiveSessionId] = useState(null);

  const handleStart = useCallback(async (config) => {
    const data = await startTest(config);
    const newSession = {
      id: data.sessionId,
      agentNumber: config.agentWhatsappNumber,
      label: config.agentWhatsappNumber.replace(/^55/, '').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
      totalMessages: parseInt(config.messageCount, 10),
      status: 'pending',
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(data.sessionId);
  }, []);

  const handleStatusChange = useCallback((sessionId, status) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status } : s))
    );
  }, []);

  const handleRemoveSession = useCallback((sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        setActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
        return remaining;
      });
    }
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">TestadorAI</h1>
            <p className="text-xs text-gray-500">Testador de Agentes Conversacionais WhatsApp</p>
          </div>
          {sessions.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{sessions.filter((s) => s.status === 'running').length} rodando</span>
              <span>{sessions.filter((s) => s.status === 'completed').length} concluidos</span>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
          {/* Painel Esquerdo - Form + Lista de sessoes */}
          <div className="lg:col-span-4 bg-gray-900 rounded-xl border border-gray-800 overflow-y-auto">
            <div className="p-4">
              <TunnelStatus />

              <SessionList
                sessions={sessions}
                activeId={activeSessionId}
                onSelect={setActiveSessionId}
                onRemove={handleRemoveSession}
              />

              <TestForm onStart={handleStart} disabled={false} />
            </div>
          </div>

          {/* Painel Direito - Sessao ativa */}
          <div className="lg:col-span-8 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
            {activeSession ? (
              <ActiveSession
                key={activeSession.id}
                sessionId={activeSession.id}
                totalMessages={activeSession.totalMessages}
                onStatusChange={handleStatusChange}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Inicie um teste para ver a conversa aqui
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
