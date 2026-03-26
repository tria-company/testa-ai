const statusColors = {
  pending: 'bg-yellow-500',
  configuring_webhook: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
  generating_report: 'bg-purple-500 animate-pulse',
  completed: 'bg-green-500',
  stopped: 'bg-orange-500',
  error: 'bg-red-500',
};

const statusLabels = {
  pending: 'Iniciando',
  configuring_webhook: 'Webhook',
  running: 'Rodando',
  generating_report: 'Relatorio',
  completed: 'Concluido',
  stopped: 'Parado',
  error: 'Erro',
};

export default function SessionList({ sessions, activeId, onSelect, onRemove }) {
  if (sessions.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Testes ativos</h3>
      <div className="space-y-1.5">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
              s.id === activeId
                ? 'bg-blue-900/30 border border-blue-700/40 text-white'
                : 'bg-gray-800/50 border border-gray-700/30 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${statusColors[s.status] || 'bg-gray-500'}`} />
              <span className="truncate">{s.label || s.agentNumber}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-gray-500 text-[10px]">
                {statusLabels[s.status] || s.status}
              </span>
              {(s.status === 'completed' || s.status === 'stopped' || s.status === 'error') && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  x
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
