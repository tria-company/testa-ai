const statusConfig = {
  idle: { label: 'Aguardando', color: 'bg-gray-500' },
  pending: { label: 'Iniciando...', color: 'bg-yellow-500' },
  configuring_webhook: { label: 'Configurando webhook...', color: 'bg-yellow-500' },
  running: { label: 'Teste em andamento', color: 'bg-blue-500 animate-pulse' },
  generating_report: { label: 'Gerando relatório...', color: 'bg-purple-500 animate-pulse' },
  completed: { label: 'Concluído', color: 'bg-green-500' },
  stopped: { label: 'Parado', color: 'bg-orange-500' },
  error: { label: 'Erro', color: 'bg-red-500' },
};

export default function StatusIndicator({ status }) {
  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
      <span className="text-sm text-gray-300">{config.label}</span>
    </div>
  );
}
