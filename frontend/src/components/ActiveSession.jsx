import { useTestSession } from '../hooks/useTestSession';
import ConversationView from './ConversationView';
import ReportCard from './ReportCard';
import StatusIndicator from './StatusIndicator';
import { stopTest } from '../services/api';
import { useState, useEffect } from 'react';

export default function ActiveSession({ sessionId, totalMessages, onStatusChange }) {
  const { status, conversation, report, persona, error, messagesRemaining } = useTestSession(sessionId);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'report'

  // Notifica o pai quando o status muda
  useEffect(() => {
    if (onStatusChange) onStatusChange(sessionId, status, persona, report);
  }, [status, persona, report, sessionId, onStatusChange]);

  // Troca pra aba de relatorio automaticamente quando completa
  useEffect(() => {
    if (report) setActiveTab('report');
  }, [report]);

  const isRunning = ['pending', 'configuring_webhook', 'running', 'generating_report'].includes(status);

  const handleStop = async () => {
    try {
      await stopTest(sessionId);
    } catch (err) {
      console.error('Erro ao parar teste:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          {persona && (
            <span className="text-xs text-gray-500">Persona: {persona.customerName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <div className="flex bg-gray-800 rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 transition-colors ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1 transition-colors ${activeTab === 'report' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Relatorio
              </button>
            </div>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg transition-colors font-medium"
            >
              Parar
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ConversationView
            conversation={conversation}
            status={status}
            messagesRemaining={messagesRemaining}
            totalMessages={totalMessages}
          />
        )}
        {activeTab === 'report' && (
          <div className="h-full overflow-y-auto p-4">
            <ReportCard report={report} />
          </div>
        )}
      </div>

      {/* Persona + Error no rodape quando em chat */}
      {activeTab === 'chat' && (persona || error) && (
        <div className="px-4 py-2 border-t border-gray-800 shrink-0 max-h-32 overflow-y-auto">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-1.5 text-xs text-red-300 mb-2">
              {error}
            </div>
          )}
          {persona && (
            <div className="text-[10px] text-gray-600 flex flex-wrap gap-x-3">
              <span>{persona.customerName}</span>
              {persona.personalInfo && <span>{persona.personalInfo.occupation}</span>}
              <span>{persona.businessType}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
