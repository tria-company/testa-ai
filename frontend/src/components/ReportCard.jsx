import { useState } from 'react';
import { reportToMarkdown } from '../utils/reportToMarkdown';

function ScoreBadge({ score, size = 'md' }) {
  const color =
    score >= 7 ? 'text-green-400 border-green-500/30 bg-green-500/10'
    : score >= 5 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    : 'text-red-400 border-red-500/30 bg-red-500/10';

  const sizeClass = size === 'lg' ? 'text-3xl w-16 h-16' : 'text-lg w-10 h-10';

  return (
    <div className={`${sizeClass} ${color} border rounded-xl flex items-center justify-center font-bold`}>
      {typeof score === 'number' ? score.toFixed(1) : score}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const v = verdict.toUpperCase();
  const style =
    v === 'APROVADO' ? 'bg-green-600 text-white'
    : v === 'REPROVADO' ? 'bg-red-600 text-white'
    : 'bg-yellow-600 text-white';
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${style}`}>{verdict}</span>
  );
}

function SeverityBadge({ severity }) {
  if (!severity) return null;
  const s = severity.toLowerCase();
  const style =
    s === 'critica' || s === 'crítica' ? 'bg-red-700 text-white'
    : s === 'grave' ? 'bg-red-600 text-white'
    : s === 'moderada' ? 'bg-yellow-600 text-white'
    : s === 'leve' ? 'bg-yellow-800 text-yellow-200'
    : 'bg-gray-700 text-gray-300';
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style}`}>{severity}</span>;
}

function Section({ title, score, badge, children }) {
  return (
    <div className="border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-200">{title}</h3>
          {badge}
        </div>
        {score !== undefined && <ScoreBadge score={score} />}
      </div>
      {children}
    </div>
  );
}

export default function ReportCard({ report }) {
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const handleCopyMarkdown = async () => {
    const md = reportToMarkdown(report);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Botao Copiar Markdown */}
      <button
        onClick={handleCopyMarkdown}
        className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium py-2 px-4 rounded-lg transition-colors border border-gray-700"
      >
        {copied ? 'Copiado!' : 'Copiar Relatorio em Markdown'}
      </button>

      {/* Header com nota geral + veredicto */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Nota Geral do Agente</p>
        <div className="flex items-center justify-center gap-4">
          <ScoreBadge score={report.overallScore} size="lg" />
          <VerdictBadge verdict={report.verdict} />
        </div>
        <p className="text-sm text-gray-300 mt-3 max-w-lg mx-auto">{report.summary}</p>
      </div>

      {/* Aderencia ao Fluxo */}
      <Section title="Aderencia ao Fluxo" score={report.flowAdherence?.score}>
        <p className="text-sm text-gray-400">{report.flowAdherence?.analysis}</p>
        {report.flowAdherence?.stepsMissed?.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-red-400 font-medium mb-1">Passos que faltaram:</p>
            {report.flowAdherence.stepsMissed.map((step, i) => (
              <p key={i} className="text-xs text-red-300 ml-2">- {step}</p>
            ))}
          </div>
        )}
        {report.flowAdherence?.issues?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {report.flowAdherence.issues.map((issue, i) => (
              <li key={i} className="text-sm text-yellow-300 flex gap-2">
                <span className="text-yellow-500 shrink-0">!</span> {issue}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Alucinacoes */}
      <Section
        title="Deteccao de Alucinacoes"
        score={report.hallucinationDetection?.score}
        badge={<SeverityBadge severity={report.hallucinationDetection?.severity} />}
      >
        <p className="text-sm text-gray-400">{report.hallucinationDetection?.analysis}</p>
        {report.hallucinationDetection?.instances?.length > 0 ? (
          <div className="space-y-2 mt-2">
            {report.hallucinationDetection.instances.map((inst, i) => (
              <div key={i} className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-400 font-mono text-xs">Msg #{inst.messageNumber}</span>
                  <SeverityBadge severity={inst.severity} />
                </div>
                <p className="text-gray-300">{inst.issue}</p>
                {inst.agentSaid && (
                  <p className="text-red-300 text-xs mt-1">Agente disse: "{inst.agentSaid}"</p>
                )}
                {inst.impact && (
                  <p className="text-orange-300 text-xs mt-1">Impacto: {inst.impact}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-400 mt-2">Nenhuma alucinacao detectada.</p>
        )}
      </Section>

      {/* Retencao de Memoria */}
      <Section title="Retencao de Memoria" score={report.memoryRetention?.score}>
        <p className="text-sm text-gray-400">{report.memoryRetention?.analysis}</p>
        {report.memoryRetention?.instances?.length > 0 && (
          <div className="space-y-2 mt-2">
            {report.memoryRetention.instances.map((inst, i) => (
              <div key={i} className={`${inst.agentRecalled ? 'bg-green-900/20 border-green-800/30' : 'bg-red-900/20 border-red-800/30'} border rounded-lg p-3 text-sm`}>
                <div className="flex items-center gap-2">
                  <span className={`${inst.agentRecalled ? 'text-green-400' : 'text-red-400'} font-mono text-xs`}>
                    Msg #{inst.messageNumber} (info na msg #{inst.infoGivenAt})
                  </span>
                </div>
                <p className="text-gray-300 mt-1">
                  {inst.agentRecalled ? 'Lembrou' : 'Esqueceu'}: {inst.detail}
                </p>
                <p className="text-gray-500 text-xs mt-1">Info original: "{inst.originalInfo}"</p>
                {inst.severity && <p className="text-gray-500 text-xs mt-1">Impacto: {inst.severity}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Comportamento fora de contexto */}
      <Section title="Comportamento Fora de Contexto" score={report.outOfContextBehavior?.score}>
        <p className="text-sm text-gray-400">{report.outOfContextBehavior?.analysis}</p>
        {report.outOfContextBehavior?.instances?.length > 0 ? (
          <div className="space-y-2 mt-2">
            {report.outOfContextBehavior.instances.map((inst, i) => (
              <div key={i} className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 text-sm">
                <span className="text-red-400 font-mono text-xs">Msg #{inst.messageNumber}</span>
                {inst.clientSaid && <p className="text-blue-300 text-xs mt-1">Cliente: "{inst.clientSaid}"</p>}
                {inst.agentResponse && <p className="text-red-300 text-xs mt-1">Agente: "{inst.agentResponse}"</p>}
                {inst.expectedBehavior && <p className="text-green-300 text-xs mt-1">Esperado: {inst.expectedBehavior}</p>}
                <p className="text-gray-300 mt-1">{inst.issue}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-400 mt-2">Nenhuma ocorrencia detectada.</p>
        )}
      </Section>

      {/* Compliance do Prompt */}
      {report.promptCompliance && (
        <Section title="Compliance do Prompt" score={report.promptCompliance.score}>
          <p className="text-sm text-gray-400">{report.promptCompliance.analysis}</p>
          {report.promptCompliance.violations?.length > 0 && (
            <div className="space-y-2 mt-2">
              {report.promptCompliance.violations.map((v, i) => (
                <div key={i} className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 text-sm">
                  <span className="text-red-400 font-mono text-xs">Msg #{v.messageNumber}</span>
                  <p className="text-yellow-300 text-xs mt-1">Regra: {v.rule}</p>
                  <p className="text-gray-300 mt-1">{v.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Qualidade da Conversa */}
      <Section title="Qualidade da Conversa" score={report.conversationQuality?.score}>
        <div className="space-y-2 text-sm">
          <p className="text-gray-400"><span className="text-gray-300 font-medium">Naturalidade:</span> {report.conversationQuality?.naturalness}</p>
          <p className="text-gray-400"><span className="text-gray-300 font-medium">Consistencia:</span> {report.conversationQuality?.consistency}</p>
          <p className="text-gray-400"><span className="text-gray-300 font-medium">Utilidade:</span> {report.conversationQuality?.helpfulness}</p>
          {report.conversationQuality?.empathy && (
            <p className="text-gray-400"><span className="text-gray-300 font-medium">Empatia:</span> {report.conversationQuality.empathy}</p>
          )}
        </div>
        {report.conversationQuality?.issues?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {report.conversationQuality.issues.map((issue, i) => (
              <li key={i} className="text-sm text-yellow-300 flex gap-2">
                <span className="text-yellow-500 shrink-0">!</span> {issue}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Tempo de Resposta */}
      <Section title="Tempo de Resposta" badge={
        report.responseTimeAnalysis?.verdict && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            report.responseTimeAnalysis.verdict === 'RÁPIDO' || report.responseTimeAnalysis.verdict === 'RAPIDO'
              ? 'bg-green-700 text-white'
              : report.responseTimeAnalysis.verdict === 'ACEITÁVEL' || report.responseTimeAnalysis.verdict === 'ACEITAVEL'
                ? 'bg-yellow-700 text-white'
                : 'bg-red-700 text-white'
          }`}>{report.responseTimeAnalysis.verdict}</span>
        )
      }>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: 'Media', value: report.responseTimeAnalysis?.averageMs },
            { label: 'Minimo', value: report.responseTimeAnalysis?.minMs },
            { label: 'Maximo', value: report.responseTimeAnalysis?.maxMs },
            { label: 'Mediana', value: report.responseTimeAnalysis?.medianMs },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-semibold text-gray-200">
                {value ? `${(value / 1000).toFixed(1)}s` : '-'}
              </p>
            </div>
          ))}
        </div>
        {report.responseTimeAnalysis?.timeouts > 0 && (
          <p className="text-sm text-red-400">
            Timeouts: {report.responseTimeAnalysis.timeouts} mensagem(ns) sem resposta
          </p>
        )}
        <p className="text-sm text-gray-400 mt-2">{report.responseTimeAnalysis?.assessment}</p>
      </Section>

      {/* Recomendacao de LLM */}
      <Section title="Recomendacao de LLM">
        <p className="text-sm text-gray-400 mb-2">{report.llmRecommendation?.currentAssessment}</p>
        <div className={`rounded-lg p-3 text-sm ${
          report.llmRecommendation?.shouldChange
            ? 'bg-yellow-900/20 border border-yellow-700/30 text-yellow-300'
            : 'bg-green-900/20 border border-green-700/30 text-green-300'
        }`}>
          {report.llmRecommendation?.shouldChange ? 'Recomenda troca: ' : 'LLM atual adequada: '}
          {report.llmRecommendation?.suggestion}
        </div>
        {report.llmRecommendation?.reasoning && (
          <p className="text-xs text-gray-500 mt-2">{report.llmRecommendation.reasoning}</p>
        )}
      </Section>

      {/* Melhorias */}
      <Section title="Melhorias Sugeridas">
        <div className="space-y-3">
          {report.improvements?.map((item, i) => (
            <div key={i} className={`border-l-2 pl-3 ${
              item.priority === 'critica' || item.priority === 'crítica' ? 'border-red-500'
              : item.priority === 'alta' ? 'border-orange-500'
              : item.priority === 'media' || item.priority === 'média' ? 'border-yellow-500'
              : 'border-blue-500'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  item.priority === 'critica' || item.priority === 'crítica' ? 'bg-red-900/50 text-red-300'
                  : item.priority === 'alta' ? 'bg-orange-900/50 text-orange-300'
                  : item.priority === 'media' || item.priority === 'média' ? 'bg-yellow-900/50 text-yellow-300'
                  : 'bg-gray-700 text-gray-300'
                }`}>
                  {item.priority || 'media'}
                </span>
                <span className="text-sm font-medium text-gray-200">{item.area}</span>
              </div>
              <p className="text-sm text-gray-400">{item.description}</p>
              {item.evidence && (
                <p className="text-xs text-gray-500 mt-1">Evidencia: {item.evidence}</p>
              )}
              {item.suggestion && (
                <p className="text-sm text-blue-300 mt-1">Sugestao: {item.suggestion}</p>
              )}
              {item.promptFix && (
                <div className="mt-1 bg-gray-800 rounded p-2">
                  <p className="text-[10px] text-gray-500 mb-1">Correcao no prompt:</p>
                  <p className="text-xs text-emerald-300 font-mono">{item.promptFix}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Metadados */}
      {report.testMetadata && (
        <div className="text-xs text-gray-600 text-center space-y-1 pt-2">
          <p>Sessao: {report.testMetadata.sessionId}</p>
          <p>Duracao: {Math.round(report.testMetadata.testDuration / 1000)}s | Msgs enviadas: {report.testMetadata.totalMessagesSent} | Respostas: {report.testMetadata.totalMessagesReceived}</p>
          <p>Concluido em: {report.testMetadata.completedAt}</p>
        </div>
      )}
    </div>
  );
}
