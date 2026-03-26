import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function TypingIndicator() {
  return (
    <div className="flex justify-end mb-3">
      <div className="bg-emerald-700/50 rounded-2xl rounded-br-md px-4 py-3">
        <div className="flex gap-1">
          <div className="typing-dot w-2 h-2 bg-white rounded-full" />
          <div className="typing-dot w-2 h-2 bg-white rounded-full" />
          <div className="typing-dot w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function ConversationView({ conversation, status, messagesRemaining, totalMessages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const isWaitingForAgent =
    status === 'running' &&
    conversation.length > 0 &&
    conversation[conversation.length - 1].role === 'tester';

  const progress = totalMessages > 0
    ? Math.round(((totalMessages - messagesRemaining) / totalMessages) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300">Conversa ao Vivo</h2>
        {status === 'running' && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {totalMessages - messagesRemaining}/{totalMessages} mensagens
            </span>
            <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {conversation.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {status === 'idle'
              ? 'Configure e inicie um teste para ver a conversa.'
              : 'Aguardando mensagens...'}
          </div>
        )}

        {conversation.map((msg, i) => (
          <MessageBubble key={i} {...msg} />
        ))}

        {isWaitingForAgent && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
