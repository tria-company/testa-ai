export default function MessageBubble({ role, content, timestamp, responseTimeMs, timeout }) {
  const isTester = role === 'tester';
  const time = timestamp ? new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <div className={`flex ${isTester ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isTester
            ? 'bg-gray-700 text-gray-100 rounded-bl-md'
            : timeout
              ? 'bg-red-900/50 text-red-200 rounded-br-md border border-red-700'
              : 'bg-emerald-700 text-white rounded-br-md'
        }`}
      >
        <div className="text-xs font-medium mb-1 opacity-70">
          {isTester ? 'Cliente (Simulado)' : 'Agente'}
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <div className="flex items-center justify-end gap-2 mt-1">
          {responseTimeMs && !timeout && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                responseTimeMs < 5000
                  ? 'bg-green-800/50 text-green-300'
                  : responseTimeMs < 15000
                    ? 'bg-yellow-800/50 text-yellow-300'
                    : 'bg-red-800/50 text-red-300'
              }`}
            >
              {(responseTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-xs opacity-50">{time}</span>
        </div>
      </div>
    </div>
  );
}
