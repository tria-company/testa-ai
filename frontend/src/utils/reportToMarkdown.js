function productionLine(report) {
  const score = typeof report.overallScore === 'number' ? report.overallScore : parseFloat(report.overallScore);
  const v = (report.verdict || '').toUpperCase();
  if (v === 'APROVADO' || score >= 7) {
    return {
      status: 'SIM',
      label: 'Pode usar em producao',
      detail: 'Agente cumpre seu papel com qualidade suficiente para atender clientes reais.',
    };
  }
  if (v === 'REPROVADO' || score < 5) {
    return {
      status: 'NAO',
      label: 'Nao recomendado para producao',
      detail: 'Falhas graves comprometem a experiencia — corrija os problemas criticos antes de liberar.',
    };
  }
  return {
    status: 'COM RESSALVAS',
    label: 'Usar em producao somente apos ajustes',
    detail: 'Funciona em parte, mas tem problemas que um cliente real perceberia. Aplique as melhorias sugeridas antes.',
  };
}

export function reportToMarkdown(report) {
  if (!report) return '';

  const lines = [];
  const prod = productionLine(report);
  const scoreFormatted = typeof report.overallScore === 'number' ? report.overallScore.toFixed(1) : report.overallScore;

  // Header
  lines.push(`# Relatorio TestadorAI - Nota: ${scoreFormatted}/10 | ${report.verdict || ''}`);
  lines.push('');
  lines.push(`**Nota final:** ${scoreFormatted}/10`);
  lines.push(`**Pode usar em producao?** ${prod.status} — ${prod.label}`);
  lines.push('');
  lines.push(`> ${prod.detail}`);
  lines.push('');
  lines.push(`> ${report.summary}`);
  lines.push('');

  // Aderencia ao Fluxo
  if (report.flowAdherence) {
    lines.push(`## Aderencia ao Fluxo (${report.flowAdherence.score}/10)`);
    lines.push('');
    lines.push(report.flowAdherence.analysis);
    if (report.flowAdherence.stepsMissed?.length > 0) {
      lines.push('');
      lines.push('**Passos que faltaram:**');
      report.flowAdherence.stepsMissed.forEach((s) => lines.push(`- ${s}`));
    }
    if (report.flowAdherence.issues?.length > 0) {
      lines.push('');
      lines.push('**Problemas:**');
      report.flowAdherence.issues.forEach((issue) => lines.push(`- ${issue}`));
    }
    lines.push('');
  }

  // Alucinacoes
  if (report.hallucinationDetection) {
    const h = report.hallucinationDetection;
    lines.push(`## Deteccao de Alucinacoes (${h.score}/10) — Severidade: ${h.severity || 'N/A'}`);
    lines.push('');
    lines.push(h.analysis);
    if (h.instances?.length > 0) {
      lines.push('');
      h.instances.forEach((inst) => {
        lines.push(`- **[${(inst.severity || '').toUpperCase()}] Msg #${inst.messageNumber}**: ${inst.issue}`);
        if (inst.agentSaid) lines.push(`  - Agente disse: "${inst.agentSaid}"`);
        if (inst.impact) lines.push(`  - Impacto: ${inst.impact}`);
      });
    }
    lines.push('');
  }

  // Retencao de Memoria
  if (report.memoryRetention) {
    lines.push(`## Retencao de Memoria (${report.memoryRetention.score}/10)`);
    lines.push('');
    lines.push(report.memoryRetention.analysis);
    if (report.memoryRetention.instances?.length > 0) {
      lines.push('');
      report.memoryRetention.instances.forEach((inst) => {
        const icon = inst.agentRecalled ? 'LEMBROU' : 'ESQUECEU';
        lines.push(`- **[${icon}] Msg #${inst.messageNumber}** (info na msg #${inst.infoGivenAt}): ${inst.detail}`);
        if (inst.originalInfo) lines.push(`  - Info original: "${inst.originalInfo}"`);
      });
    }
    lines.push('');
  }

  // Comportamento Fora de Contexto
  if (report.outOfContextBehavior) {
    lines.push(`## Comportamento Fora de Contexto (${report.outOfContextBehavior.score}/10)`);
    lines.push('');
    lines.push(report.outOfContextBehavior.analysis);
    if (report.outOfContextBehavior.instances?.length > 0) {
      lines.push('');
      report.outOfContextBehavior.instances.forEach((inst) => {
        lines.push(`- **Msg #${inst.messageNumber}**: ${inst.issue}`);
        if (inst.clientSaid) lines.push(`  - Cliente: "${inst.clientSaid}"`);
        if (inst.agentResponse) lines.push(`  - Agente: "${inst.agentResponse}"`);
        if (inst.expectedBehavior) lines.push(`  - Esperado: ${inst.expectedBehavior}`);
      });
    }
    lines.push('');
  }

  // Compliance do Prompt
  if (report.promptCompliance) {
    lines.push(`## Compliance do Prompt (${report.promptCompliance.score}/10)`);
    lines.push('');
    lines.push(report.promptCompliance.analysis);
    if (report.promptCompliance.violations?.length > 0) {
      lines.push('');
      lines.push('**Violacoes:**');
      report.promptCompliance.violations.forEach((v) => {
        lines.push(`- **Msg #${v.messageNumber}** — Regra: "${v.rule}" — ${v.detail}`);
      });
    }
    lines.push('');
  }

  // Qualidade da Conversa
  if (report.conversationQuality) {
    lines.push(`## Qualidade da Conversa (${report.conversationQuality.score}/10)`);
    lines.push('');
    lines.push(`- **Naturalidade:** ${report.conversationQuality.naturalness}`);
    lines.push(`- **Consistencia:** ${report.conversationQuality.consistency}`);
    lines.push(`- **Utilidade:** ${report.conversationQuality.helpfulness}`);
    if (report.conversationQuality.empathy) {
      lines.push(`- **Empatia:** ${report.conversationQuality.empathy}`);
    }
    if (report.conversationQuality.issues?.length > 0) {
      lines.push('');
      report.conversationQuality.issues.forEach((i) => lines.push(`- ! ${i}`));
    }
    lines.push('');
  }

  // Tempo de Resposta
  if (report.responseTimeAnalysis) {
    const r = report.responseTimeAnalysis;
    lines.push(`## Tempo de Resposta — ${r.verdict || ''}`);
    lines.push('');
    lines.push('| Metrica | Valor |');
    lines.push('|---------|-------|');
    lines.push(`| Media | ${r.averageMs ? (r.averageMs / 1000).toFixed(1) + 's' : '-'} |`);
    lines.push(`| Minimo | ${r.minMs ? (r.minMs / 1000).toFixed(1) + 's' : '-'} |`);
    lines.push(`| Maximo | ${r.maxMs ? (r.maxMs / 1000).toFixed(1) + 's' : '-'} |`);
    lines.push(`| Mediana | ${r.medianMs ? (r.medianMs / 1000).toFixed(1) + 's' : '-'} |`);
    lines.push(`| Timeouts | ${r.timeouts || 0} |`);
    lines.push('');
    if (r.assessment) lines.push(r.assessment);
    lines.push('');
  }

  // Recomendacao de LLM
  if (report.llmRecommendation) {
    lines.push('## Recomendacao de LLM');
    lines.push('');
    lines.push(report.llmRecommendation.currentAssessment);
    lines.push('');
    const prefix = report.llmRecommendation.shouldChange ? '**Recomenda troca:**' : '**LLM atual adequada:**';
    lines.push(`${prefix} ${report.llmRecommendation.suggestion}`);
    if (report.llmRecommendation.reasoning) {
      lines.push('');
      lines.push(`_${report.llmRecommendation.reasoning}_`);
    }
    lines.push('');
  }

  // Melhorias
  if (report.improvements?.length > 0) {
    lines.push('## Melhorias Sugeridas');
    lines.push('');
    report.improvements.forEach((item, i) => {
      const priority = (item.priority || 'media').toUpperCase();
      lines.push(`${i + 1}. **[${priority}] ${item.area}**: ${item.description}`);
      if (item.evidence) lines.push(`   - _Evidencia:_ ${item.evidence}`);
      if (item.suggestion) lines.push(`   - _Sugestao:_ ${item.suggestion}`);
      if (item.promptFix) lines.push(`   - _Correcao no prompt:_ \`${item.promptFix}\``);
    });
    lines.push('');
  }

  // Metadados
  if (report.testMetadata) {
    const m = report.testMetadata;
    lines.push('---');
    lines.push('');
    lines.push('## Metadados do Teste');
    lines.push('');
    lines.push(`- **Sessao:** ${m.sessionId}`);
    lines.push(`- **Agente:** ${m.agentNumber}`);
    lines.push(`- **Mensagens enviadas:** ${m.totalMessagesSent}`);
    lines.push(`- **Respostas recebidas:** ${m.totalMessagesReceived}`);
    lines.push(`- **Duracao:** ${Math.round(m.testDuration / 1000)}s`);
    lines.push(`- **Concluido:** ${m.completedAt}`);
  }

  return lines.join('\n');
}
