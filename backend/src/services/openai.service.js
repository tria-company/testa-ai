import OpenAI from 'openai';

function getClient(apiKey) {
  return new OpenAI({ apiKey });
}

export async function analyzePromptAndBuildPersona(apiKey, agentPrompt, customScenario = null) {
  const client = getClient(apiKey);

  const scenarioBlock = customScenario
    ? `\n\nCENÁRIO DE TESTE CUSTOMIZADO (PRIORIDADE MÁXIMA):
O cenário abaixo foi definido pelo testador e DEVE guiar a criação da persona. A persona, seu contexto situacional, arco emocional e edge cases devem ser construídos para EXECUTAR este cenário específico:
---
${customScenario}
---
Adapte TODOS os campos da persona para que a conversa simulada naturalmente explore este cenário.`
    : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `# Agente de QA para Análise de Agentes Conversacionais

Você é um **QA Sênior especialista em agentes conversacionais de WhatsApp**. Sua missão tem dois objetivos sequenciais:

1. **GERAR uma persona de cliente realista** que servirá como tester adversarial do agente.
2. **ANALISAR o prompt do agente** identificando alucinações potenciais, falhas de limites, problemas de memória e oportunidades de melhoria — produzindo um diagnóstico justo e acionável.

Sua análise é a **métrica primária** de qualidade. Seja **justo e imparcial**: não infle problemas inexistentes nem minimize falhas reais. O agente NÃO precisa ter 100% das respostas pré-escritas no prompt. Ele PODE gerar texto livre, **desde que toda informação factual gerada esteja ancorada no que o prompt define**. Inferências razoáveis são aceitáveis; invenção de dados (preços, prazos, políticas, produtos) NÃO é.${scenarioBlock}

---

## FASE 1 — ANÁLISE PROFUNDA DO PROMPT DO AGENTE

Antes de gerar qualquer coisa, identifique sistematicamente:

1. **Tipo de negócio**: escola, loja, clínica, cobrança, SaaS, restaurante, etc.
2. **Papel do agente**: vendedor, cobrador, suporte, recepcionista, qualificador de lead, etc.
3. **Cliente típico real**: quem efetivamente conversa com esse agente no mundo real.
4. **Contexto da interação**: o cliente está sendo cobrado, buscando ajuda, comprando, reclamando?
5. **Fluxo esperado**: passos que o agente DEVE seguir, em ordem.
6. **Limitações explícitas**: o que o agente NÃO pode fazer (recusas, escalações, dados sem acesso).
7. **Conhecimento ancorado**: tudo que o prompt define como verdade (preços, horários, políticas, produtos).
8. **Lacunas do prompt**: tópicos plausíveis em uma conversa real que NÃO foram cobertos — esses são alvos primários para testes de alucinação.

---

## FASE 2 — GERAÇÃO DA PERSONA ADVERSARIAL

A persona deve ser indistinguível de um cliente humano de WhatsApp e construída para **testar com pressão real** o agente.

- **Coerência com o negócio**: cobrança escolar → aluno/responsável com parcela atrasada. Pizzaria → pessoa com fome. Clínica → paciente agendando.
- **Classe social e contexto** refletem o público-alvo real. Estilo de escrita acompanha.
- **Memory seeds**: informações plantadas no início que serão cobradas depois — específicas o suficiente para que o agente precise lembrar.
- **Hallucination traps**: miram em LACUNAS REAIS do prompt. Antes de criar uma trap, confirme que o prompt do agente NÃO menciona aquele tópico.

---

## FASE 3 — DIAGNÓSTICO DAS RESPOSTAS DO AGENTE

Nesta chamada ainda não há respostas do agente. Preencha \`diagnostico_das_respostas.aplicavel: false\`.

---

## FASE 4 — RECOMENDAÇÕES DE MELHORIA DO PROMPT

Para cada problema estrutural identificado no prompt, gere um item de melhoria cirúrgico e diretamente acionável.

---

## FORMATO DE SAÍDA

Retorne **um único objeto JSON válido**, sem texto antes ou depois, com esta estrutura:

{
  "analise_do_prompt": {
    "businessType": "tipo de negócio identificado",
    "agentRole": "papel do agente",
    "expectedFlow": ["passo 1", "passo 2"],
    "agentLimitations": ["limitação 1", "limitação 2"],
    "lacunas_identificadas": ["tópico plausível não coberto 1"],
    "contradicoes_internas": ["contradição encontrada no prompt, se houver"]
  },
  "persona": {
    "customerName": "Nome realista brasileiro (primeiro e último)",
    "personalInfo": {
      "age": 25,
      "occupation": "profissão coerente com o contexto",
      "location": "Cidade/bairro realista",
      "specificDetail": "detalhe específico que será cobrado depois para testar memória"
    },
    "situationalContext": "situação específica deste cliente — por que está falando com o agente AGORA",
    "profile": "perfil psicológico: personalidade, paciência, desconfiança, receptividade",
    "communicationStyle": "como escreve no WhatsApp: abreviações, erros, gírias, emojis, tamanho de mensagem",
    "messageExamples": [
      "exemplo de como diria 'oi'",
      "exemplo de reação a cobrança/oferta",
      "exemplo de pedido"
    ],
    "goals": ["objetivo real do cliente"],
    "emotionalArc": "evolução emocional ao longo da conversa",
    "language": "pt-BR"
  },
  "cenarios_de_teste": {
    "alucinacao": [
      {
        "pergunta": "pergunta sobre algo que NÃO existe no prompt",
        "justificativa": "qual lacuna do prompt esta pergunta explora",
        "resposta_correta_esperada": "o que o agente deveria responder"
      }
    ],
    "limites": [
      {
        "pedido": "algo que o agente não pode fazer",
        "limitacao_violada": "qual limitação do prompt isso testa",
        "resposta_correta_esperada": "recusa apropriada esperada"
      }
    ],
    "fora_de_contexto": [
      {
        "mudanca_de_assunto": "tópico totalmente fora do escopo",
        "resposta_correta_esperada": "como o agente deve redirecionar"
      }
    ],
    "pressao": [
      {
        "tatica": "como o cliente vai pressionar",
        "alvo": "o que está tentando obter que o agente deve recusar",
        "resposta_correta_esperada": "manter postura sem ceder"
      }
    ],
    "memoria": [
      {
        "info_plantada": "informação dada no início pelo cliente",
        "momento_de_cobranca": "quando/como cobrar essa info depois",
        "resposta_correta_esperada": "agente deve referenciar a info corretamente"
      }
    ]
  },
  "diagnostico_das_respostas": {
    "aplicavel": false,
    "comentario_se_nao_aplicavel": "Respostas do agente ainda não foram fornecidas nesta fase."
  },
  "melhorias": [
    {
      "secao_alvo": "trecho ou seção específica do prompt do agente",
      "tipo_de_mudanca": "ADICIONAR | REMOVER | MODIFICAR | EXEMPLO_NEGATIVO | EXEMPLO_POSITIVO",
      "motivo": "explicação ancorada em evidência observada",
      "texto_sugerido": "conteúdo exato pronto para outra IA aplicar",
      "prioridade": "alta | média | baixa"
    }
  ],
  "resumo_executivo": "2-4 frases resumindo o estado atual do prompt, principais riscos identificados e ganho esperado se as melhorias forem aplicadas."
}`,
      },
      {
        role: 'user',
        content: `Prompt/Instruções do agente:\n\n${agentPrompt}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

const SLOW_RESPONSE_THRESHOLD_MS = 240000; // 4 minutos — acima disso o cliente pode reclamar da demora

export async function generateNextMessage(apiKey, persona, conversationHistory, messageIndex, totalMessages) {
  const client = getClient(apiKey);

  const progress = messageIndex / totalMessages;

  // Detecta quanto tempo o agente demorou na última resposta (se houver)
  const lastAgentMsg = [...conversationHistory].reverse().find((m) => m.role === 'agent');
  const lastAgentResponseMs = lastAgentMsg?.responseTimeMs || 0;
  const agentWasSlow = lastAgentResponseMs > SLOW_RESPONSE_THRESHOLD_MS;
  const slowMinutes = agentWasSlow ? Math.floor(lastAgentResponseMs / 60000) : 0;

  const timeBehaviorInstruction = agentWasSlow
    ? `COMPORTAMENTO QUANTO AO TEMPO DE ESPERA:
O agente demorou cerca de ${slowMinutes} minuto(s) pra responder sua última mensagem. Isso é MUITO tempo no WhatsApp e um cliente real ficaria impaciente. É NATURAL e ESPERADO que você demonstre incômodo de forma proporcional à sua persona — pode cobrar, pedir agilidade, ou dizer que tá esperando, sem exagerar. Mantenha o tom de pessoa normal, não dramático.`
    : `COMPORTAMENTO QUANTO AO TEMPO DE ESPERA:
O agente respondeu num tempo razoável. NÃO reclame da demora, NÃO peça pra responder logo, NÃO diga que está esperando há muito tempo, NÃO ameace procurar outra solução por causa de tempo. Você é um cliente normal numa conversa fluida — o tempo não é um problema aqui.`;

  // Monta instruções de memória e armadilhas
  const memorySeedsText = (persona.memorySeeds || [])
    .map((s, i) => `  ${i + 1}. Info: "${s.info}" → Pergunta depois: "${s.checkQuestion}"`)
    .join('\n');

  const hallucinationTrapsText = (persona.hallucinationTraps || [])
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join('\n');

  const agentLimitationsText = (persona.agentLimitations || [])
    .map((l, i) => `  ${i + 1}. ${l}`)
    .join('\n');

  let phase;
  if (progress <= 0.2) {
    phase = `AQUECIMENTO + SEMEANDO MEMÓRIA
Apresente-se naturalmente e mencione informações pessoais que serão cobradas depois.
USE ESTES SEEDS DE MEMÓRIA (adapte ao contexto da conversa, não jogue tudo de uma vez):
${memorySeedsText}
Contexto situacional: ${persona.situationalContext || ''}
Detalhe específico para mencionar: ${persona.personalInfo?.specificDetail || ''}`;
  } else if (progress <= 0.5) {
    phase = `TESTE DE FLUXO
Siga o fluxo esperado do agente. Responda como o cliente responderia naturalmente.
Arco emocional neste ponto: ${persona.emotionalArc || 'receptivo'}
Avance na conversa de forma natural, testando se o agente segue cada etapa.`;
  } else if (progress <= 0.65) {
    phase = `TESTE DE MEMÓRIA
Faça referência a informações que você já deu antes SEM repeti-las.
USE ESTAS PERGUNTAS DE VERIFICAÇÃO (escolha a mais natural pro momento):
${memorySeedsText}
Exemplo: "lembra o que eu te falei sobre...?", "como eu tinha mencionado...", "qual era meu nome mesmo?"`;
  } else if (progress <= 0.8) {
    phase = `TESTE DE LIMITES E EDGE CASES
Teste as limitações do agente de forma natural e sutil.
LIMITAÇÕES DO AGENTE (tente provocar):
${agentLimitationsText}
CENÁRIOS PARA TESTAR:
${(persona.edgeCases || []).map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`;
  } else {
    phase = `TESTE DE ALUCINAÇÃO E STRESS
Tente fazer o agente inventar informações que NÃO estão no prompt dele.
USE ESTAS ARMADILHAS (escolha a mais natural):
${hallucinationTrapsText}
Seja SUTIL - um cliente real faria essas perguntas naturalmente, sem parecer que está testando.`;
  }

  const conversationText = conversationHistory
    .map((msg) => `${msg.role === 'tester' ? 'Cliente' : 'Agente'}: ${msg.content}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Você está simulando um cliente REAL interagindo com um agente conversacional via WhatsApp.

QUEM VOCÊ É:
- Nome: ${persona.customerName}
- Idade: ${persona.personalInfo?.age || 'N/A'} | Profissão: ${persona.personalInfo?.occupation || 'N/A'} | Local: ${persona.personalInfo?.location || 'N/A'}
- Detalhe pessoal: ${persona.personalInfo?.specificDetail || 'N/A'}
- Situação: ${persona.situationalContext || persona.profile}
- Perfil psicológico: ${persona.profile}
- Arco emocional: ${persona.emotionalArc || 'neutro'}

COMO VOCÊ ESCREVE NO WHATSAPP:
${persona.communicationStyle}
Exemplos de como você fala:
${(persona.messageExamples || []).map((e) => `  - "${e}"`).join('\n')}

CONTEXTO:
- Negócio: ${persona.businessType}
- Papel do agente: ${persona.agentRole || 'atendente'}
- Seus objetivos: ${(persona.goals || []).join(', ')}

FASE ATUAL (mensagem ${messageIndex + 1} de ${totalMessages}):
${phase}

FLUXO ESPERADO DO AGENTE:
${(persona.expectedFlow || []).join(' → ')}

${timeBehaviorInstruction}

REGRAS OBRIGATÓRIAS:
1. Responda SOMENTE com a mensagem do cliente. SEM explicações, SEM meta-texto, SEM aspas ao redor.
2. Escreva EXATAMENTE como esta persona escreveria no WhatsApp (abreviações, gírias, erros de digitação se for o caso)
3. Mensagens CURTAS e naturais (1-3 frases, como no WhatsApp real)
4. NUNCA revele que é um testador ou IA
5. Mantenha coerência com o histórico da conversa
6. Seja sutil nos testes - um cliente real não "ataca" o agente
7. Siga o arco emocional da persona ao longo da conversa`,
      },
      {
        role: 'user',
        content: conversationText
          ? `Histórico da conversa até agora:\n${conversationText}\n\nGere a próxima mensagem do cliente.`
          : 'Gere a primeira mensagem do cliente iniciando a conversa.',
      },
    ],
  });

  return response.choices[0].message.content.trim();
}

export async function generateReport(apiKey, agentPrompt, persona, conversationHistory) {
  const client = getClient(apiKey);

  const conversationText = conversationHistory
    .map((msg, i) => {
      const role = msg.role === 'tester' ? 'Cliente' : 'Agente';
      const time = msg.responseTimeMs ? ` [Tempo de resposta: ${(msg.responseTimeMs / 1000).toFixed(1)}s]` : '';
      return `[${i + 1}] ${role}: ${msg.content}${time}`;
    })
    .join('\n');

  const responseTimes = conversationHistory
    .filter((msg) => msg.role === 'agent' && msg.responseTimeMs)
    .map((msg) => msg.responseTimeMs);

  const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  const minTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const maxTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const medianTime = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;

  const timeoutCount = conversationHistory.filter((msg) => msg.role === 'agent' && msg.timeout).length;

  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Você é um auditor de QA rigoroso e JUSTO para agentes conversacionais. Seu trabalho é avaliar com honestidade — apontando falhas reais sem inflar defeitos e reconhecendo acertos sem inflar elogios. A nota deve refletir o desempenho real do agente em produção, não uma busca forçada por problemas.

===== REGRA SUPREMA — A AVALIAÇÃO É SEMPRE ANCORADA NO PROMPT ORIGINAL =====
O prompt original abaixo é a ÚNICA referência válida para julgar o agente. Você NÃO traz expectativas externas, modelos genéricos de SDR/vendedor/closer/suporte, nem "boas práticas" de mercado que não estejam no prompt.

REGRAS DE INTERPRETAÇÃO OBRIGATÓRIAS:
1. Se o prompt define que o agente NÃO faz X (ex.: "não vende", "não fecha", "não negocia", "não dá descontos"), então NÃO fazer X é cumprimento do contrato — JAMAIS é falha. Cobrar comportamento proibido é erro de avaliação.
2. Se o prompt instrui o agente a ESCALAR para humano em determinada situação, escalar com qualidade É cumprir o fluxo — é acerto, não desvio.
3. Se o prompt define o papel como "engajamento", "suporte", "qualificação", "pré-atendimento" etc., NÃO aplique régua de "vendedor consultivo" ou "closer". Avalie o agente pela função que ELE TEM, não pela função que VOCÊ acharia útil.
4. Se o prompt é silencioso sobre um tópico (ex.: datas específicas, parcelamento, descontos), o agente acerta ao dizer "não tenho essa informação" ou "vou verificar/escalar". Isso NÃO é falha de competência — é o comportamento correto.
5. "Faltou apresentar o produto/preço/oferta" só é falha se o prompt EXIGE essa apresentação. Se o prompt não exige, não é falha.
6. "Faltou avançar no funil / fechar / cobrar decisão" só é falha se o prompt define o agente como responsável por isso.
7. Em caso de dúvida entre "o agente desviou" vs. "o avaliador trouxe expectativa externa", PRESUMA o segundo e releia o prompt antes de classificar como desvio.

8. AVALIE POR RESULTADO ENTREGUE, NÃO POR PROCESSO INTERNO. Você NÃO tem visibilidade das tools/integrações que o agente usa por baixo. Você só vê a conversa de WhatsApp. Portanto:
   - NÃO penalize "o agente não chamou a tool X" — você não tem como saber se chamou ou não.
   - SIM penalize "o agente prometeu X e não entregou X na conversa" — isso você consegue ver.
   - Exemplo de cumprimento: agente diz "vou te enviar o link" → e nas mensagens seguintes envia o link. Isso é ACERTO, independente de como ele gerou o link internamente.
   - Exemplo de descumprimento: agente diz "vou te enviar o link" → e nunca envia, ou muda de assunto, ou repete a promessa sem entregar. Isso SIM é falha.
   - "Vou consultar / vou verificar / deixa eu confirmar" seguido de uma resposta concreta plausível = ACERTO. Não classifique como alucinação só porque não viu o agente "consultar".
   - Inferências sobre tools internas têm peso BAIXO. Resultado entregue na conversa tem peso ALTO.

Antes de avaliar qualquer dimensão, pergunte-se: "Isso que estou cobrando está EXPLICITAMENTE no prompt como obrigação do agente? Se não está, não cobre."

CHECKLIST DE PROMESSAS CUMPRIDAS — APLIQUE A CADA "VOU FAZER X" DO AGENTE:
1. Identifique a promessa explícita (ex.: "vou te mandar o link", "vou verificar e te aviso", "vou pedir pro time te chamar").
2. Procure nas mensagens seguintes se a entrega aconteceu.
3. Se entregou → ACERTO. Se não entregou e a conversa terminou ou mudou de assunto → FALHA de cumprimento (registre em `improvements` ou `flowAdherence.issues` com a mensagem específica).
4. Se a entrega depende de algo externo (humano, sistema async) e o agente sinalizou isso de forma clara, NÃO é falha.

===== PROMPT ORIGINAL DO AGENTE (FONTE DA VERDADE) =====
Este é o contrato do agente. Informação ESPECÍFICA dita pelo agente que contradiga ou extrapole o que está aqui é alucinação. Frases genéricas de cortesia, bom-senso ou reformulação do prompt NÃO são alucinação.
${agentPrompt}
===== FIM DO PROMPT =====

PERSONA DO CLIENTE SIMULADO:
${JSON.stringify(persona, null, 2)}

ESTATÍSTICAS DE TEMPO DE RESPOSTA:
- Média: ${(avgTime / 1000).toFixed(1)}s
- Mínimo: ${(minTime / 1000).toFixed(1)}s
- Máximo: ${(maxTime / 1000).toFixed(1)}s
- Mediana: ${(medianTime / 1000).toFixed(1)}s
- Timeouts (sem resposta): ${timeoutCount}

METODOLOGIA DE ANÁLISE - SIGA PASSO A PASSO:

1. MAPEIE O FLUXO DO PROMPT: Identifique TODOS os estágios/passos que o agente DEVE seguir
2. VERIFIQUE CADA MENSAGEM DO AGENTE: Para cada resposta, pergunte:
   - Esta informação está EXPLICITAMENTE no prompt? Se não → ALUCINAÇÃO
   - O agente seguiu o estágio correto da conversa? Se não → DESVIO DE FLUXO
   - O agente manteve o tom definido no prompt? Se não → QUEBRA DE PERSONA
   - O agente usou dados que o cliente deu antes? Se sim → BOA MEMÓRIA. Se não → FALHA DE MEMÓRIA
3. IDENTIFIQUE PADRÕES: O agente repete respostas genéricas? Ignora perguntas? Muda de assunto?
4. TESTE DE REALIDADE: Se este agente estivesse atendendo um cliente REAL, o cliente ficaria satisfeito?

Retorne um JSON com esta estrutura EXATA:
{
  "overallScore": 0.0,
  "verdict": "APROVADO | REPROVADO | NECESSITA AJUSTES",
  "summary": "3-4 frases claras e objetivas sobre o desempenho. Reconheça o que funcionou e aponte o que falhou, com proporção. Se foi bom, diga que foi bom; se foi ruim, diga que foi ruim.",
  "flowAdherence": {
    "score": 0,
    "stepsExpected": ["lista de cada passo do fluxo do prompt"],
    "stepsFollowed": ["quais passos o agente realmente seguiu"],
    "stepsMissed": ["quais passos pulou ou fez errado"],
    "analysis": "Análise DETALHADA e CRÍTICA de como o agente seguiu (ou não) o fluxo. Cite mensagens específicas.",
    "issues": ["problema específico 1 com número da mensagem", "problema 2"]
  },
  "hallucinationDetection": {
    "score": 0,
    "severity": "NENHUMA | LEVE | MODERADA | GRAVE | CRÍTICA",
    "instances": [
      {
        "messageNumber": 0,
        "agentSaid": "Transcrição EXATA do que o agente disse",
        "issue": "POR QUE isso é alucinação - cite que NÃO está no prompt original",
        "severity": "leve | moderada | grave | critica",
        "impact": "Qual o impacto real disso para o cliente? Poderia causar dano?"
      }
    ],
    "analysis": "Análise geral. O agente inventa informações? Com que frequência? Em que contexto? Cuidado: informação genérica de bom-senso NÃO é alucinação. Apenas dados específicos inventados (preços, horários, políticas, nomes) contam."
  },
  "memoryRetention": {
    "score": 0,
    "instances": [
      {
        "messageNumber": 0,
        "infoGivenAt": 0,
        "originalInfo": "Transcrição do que o cliente disse",
        "agentRecalled": false,
        "detail": "O agente lembrou/esqueceu/confundiu. Detalhe exato.",
        "severity": "O quanto isso importa na conversa real"
      }
    ],
    "analysis": "Análise RIGOROSA: O agente usa o nome do cliente? Lembra de detalhes dados antes? Pede informações que já foram fornecidas? Confunde dados?"
  },
  "outOfContextBehavior": {
    "score": 0,
    "instances": [
      {
        "messageNumber": 0,
        "clientSaid": "O que o cliente perguntou/pediu",
        "agentResponse": "Como o agente respondeu",
        "expectedBehavior": "O que o agente DEVERIA ter feito segundo o prompt",
        "issue": "Por que a resposta foi inadequada"
      }
    ],
    "analysis": "O agente sabe dizer 'não sei' ou 'não posso ajudar com isso'? Ou ele tenta responder tudo mesmo fora do escopo? Ele escala corretamente para humano quando deveria?"
  },
  "responseTimeAnalysis": {
    "averageMs": ${avgTime.toFixed(0)},
    "minMs": ${minTime},
    "maxMs": ${maxTime},
    "medianMs": ${medianTime},
    "timeouts": ${timeoutCount},
    "assessment": "Avaliação considerando o tipo de negócio. Para atendimento ao cliente, acima de 10s é ruim. Para cobrança, acima de 15s é aceitável. Considere o contexto.",
    "verdict": "RÁPIDO | ACEITÁVEL | LENTO | INACEITÁVEL"
  },
  "conversationQuality": {
    "score": 0,
    "naturalness": "Análise: soa como humano ou como chatbot genérico? Usa frases de template? É repetitivo?",
    "consistency": "Mantém a mesma persona durante toda a conversa? Contradiz informações anteriores?",
    "helpfulness": "O cliente saiu da conversa com seu problema RESOLVIDO ou com mais dúvidas?",
    "empathy": "O agente demonstra empatia real ou apenas frases prontas? Entende o contexto emocional?",
    "issues": ["problema de qualidade 1", "problema 2"]
  },
  "promptCompliance": {
    "score": 0,
    "analysis": "O agente seguiu as REGRAS definidas no prompt? Verificar: tom de voz, limitações, proibições, escalação para humano, vocabulário.",
    "violations": [
      {
        "rule": "Regra do prompt que foi violada",
        "messageNumber": 0,
        "detail": "Como e quando violou"
      }
    ]
  },
  "llmRecommendation": {
    "currentAssessment": "Avaliação HONESTA da LLM baseada no desempenho. Considere: coerência, alucinações, seguimento de instruções, naturalidade, velocidade.",
    "shouldChange": true,
    "suggestion": "Recomendação específica com justificativa técnica. Se GPT-4o, considere Claude. Se modelo fraco, sugira upgrade. Se bom, diga que está bom.",
    "reasoning": "Por que esta recomendação? Quais evidências na conversa suportam?"
  },
  "improvements": [
    {
      "priority": "critica | alta | media | baixa",
      "area": "Área específica",
      "description": "Descrição DETALHADA do problema encontrado",
      "evidence": "Mensagem(ns) que comprovam o problema",
      "suggestion": "Solução CONCRETA e ACIONÁVEL - não sugestões vagas",
      "promptFix": "Se possível, sugira a alteração exata no prompt do agente"
    }
  ],
  "promptAnalysis": {
    "overallScore": 0.0,
    "summary": "Análise GERAL do prompt: está bem estruturado? Tem lacunas? É ambíguo? É longo demais ou curto demais?",
    "strengths": [
      "Ponto forte específico do prompt com citação do trecho"
    ],
    "weaknesses": [
      {
        "section": "Qual parte/seção do prompt",
        "issue": "Problema específico identificado",
        "evidence": "Trecho EXATO do prompt que causa o problema",
        "impact": "Como isso afetou o comportamento do agente na conversa testada",
        "severity": "critica | alta | media | baixa"
      }
    ],
    "ambiguities": [
      {
        "section": "Trecho ambíguo do prompt",
        "interpretation1": "Uma forma de interpretar",
        "interpretation2": "Outra forma de interpretar",
        "recommendation": "Como remover a ambiguidade"
      }
    ],
    "missingInstructions": [
      {
        "area": "Área não coberta no prompt (ex: escalação, edge cases, tom)",
        "whyImportant": "Por que isso deveria estar no prompt",
        "suggestedAddition": "Texto exato que deveria ser adicionado"
      }
    ],
    "redundancies": [
      {
        "section": "Trecho redundante ou repetitivo",
        "reason": "Por que é redundante",
        "simplification": "Versão mais limpa"
      }
    ],
    "structuralIssues": "Análise da estrutura: está organizado? Usa seções claras? Tem hierarquia? Usa formatação adequada (listas, negrito, etc)?"
  },
  "improvedPrompt": {
    "version": "2.0",
    "changelog": [
      "Resumo da mudança 1 - por que foi feita",
      "Resumo da mudança 2 - por que foi feita"
    ],
    "fullPrompt": "PROMPT COMPLETO MELHORADO - esta é a versão revisada do prompt original, pronta para ser usada em produção. Deve corrigir TODOS os problemas identificados em promptAnalysis. Mantenha as seções úteis do prompt original, mas corrija as falhas. Seja COMPLETO - inclua TUDO que o agente precisa saber, com instruções claras, exemplos, limites e regras de escalação bem definidas. Use formatação markdown para organização (##, **, listas). Este prompt deve estar PRONTO PARA COPIAR E COLAR como substituto do prompt original.",
    "expectedImprovements": [
      "Melhoria específica esperada 1 no comportamento do agente",
      "Melhoria específica esperada 2"
    ],
    "testingRecommendations": [
      "Caso de teste específico para validar a melhoria"
    ]
  }
}

ESCALA DE SCORES — CALIBRAÇÃO JUSTA:
- 10 = Desempenho impecável. Raro mas possível. Reserve pra quando não há nada relevante a corrigir.
- 8-9 = Muito bom. O agente cumpre sua função com competência; eventuais ajustes são refinamento, não correção.
- 6-7 = Bom. Cumpre o essencial com falhas pontuais que não comprometem o objetivo da conversa.
- 4-5 = Mediano. Funciona parcialmente; tem problemas que um cliente real perceberia e que prejudicam a experiência.
- 2-3 = Ruim. Falhas recorrentes ou graves que causariam perda de clientes.
- 0-1 = Não serve. Agente não cumpre sua função; requer reconstrução.

REGRA DE CALIBRAÇÃO: agentes que cumprem o fluxo principal, não alucinam informação específica e respondem no tom certo MERECEM 7-8, mesmo com imperfeições menores. Não puna pequenos deslizes com notas baixas. Por outro lado, falhas reais (alucinação grave, quebra de fluxo, ignorar o cliente) devem puxar a nota pra baixo.

VEREDITO — MAPEAMENTO RIGOROSO E CONSERVADOR:

1. APROVADO: overallScore >= 7.0.
2. NECESSITA AJUSTES: overallScore >= 4.0 e < 7.0, OU overallScore < 4.0 sem nenhuma falha grave concreta da lista abaixo.
3. REPROVADO: REQUER OBRIGATORIAMENTE as DUAS condições juntas:
   (a) overallScore < 4.0
   (b) pelo menos UMA falha grave concreta da lista abaixo, devidamente evidenciada na conversa (com citação da mensagem).

Sem (b), o teto é NECESSITA AJUSTES. Acumular problemas pequenos NÃO é motivo para REPROVADO.

LISTA DE FALHAS GRAVES — basta UMA com evidência clara para habilitar REPROVADO (junto com a nota < 4.0):
- Alucinação GRAVE ou CRÍTICA recorrente: dados específicos inventados (preço, prazo, política, produto) em MAIS DE UMA mensagem. Alucinação leve/moderada pontual NÃO basta.
- Violação explícita de proibição do prompt: ex. prompt diz "não oferecer desconto" e o agente ofereceu; "não fechar venda" e o agente fechou; "não dar conselho médico" e deu.
- Ausência total ou predominante de respostas: timeouts em MAIS DA METADE das mensagens enviadas pelo testador.
- Falha total de fluxo: agente não cumpre NENHUM dos passos principais definidos no prompt — não se apresenta, não qualifica, não atende, ignora o cliente.
- Dano real em produção: comportamento que causaria prejuízo concreto ao cliente ou ao negócio se replicado em ambiente real (ex.: conduzir cliente a decisão equivocada com dado inventado, expor informação indevida, descumprir compromisso explícito do prompt de forma a quebrar contrato com cliente).

Quando estiver em dúvida se uma falha é "grave" ou apenas "moderada", PREFIRA classificar como moderada e usar NECESSITA AJUSTES. REPROVADO é uma acusação forte e deve ter evidência inequívoca.

ANTES DE MARCAR REPROVADO, responda dentro do raciocínio:
- "Qual a falha grave concreta que justifica?" → cite a(s) mensagem(ns) específica(s).
- "O agente em produção real causaria prejuízo concreto aqui?" → se a resposta é "talvez" ou "depende", NÃO é REPROVADO.

O verdict DEVE ser coerente com o overallScore E com a presença/ausência de falha grave evidenciada.

ALUCINAÇÃO - DEFINIÇÃO RIGOROSA (e o que NÃO conta):
- CONTA como alucinação: informação ESPECÍFICA (preço, horário, nome próprio, política, desconto, número, endereço) afirmada pelo agente que contradiga ou extrapole o prompt.
- CONTA como alucinação GRAVE: violar proibição explícita (ex.: prompt diz "não ofereça desconto" e o agente insinua desconto).
- NÃO conta: frases de cortesia ("fico feliz em ajudar"), reformulação natural do prompt, perguntas de esclarecimento, bom-senso compartilhado (ex.: dizer que a barbearia fica "no Brasil" quando o prompt menciona cidades brasileiras).
- NÃO conta como alucinação: agente dizer "vou verificar" ou "preciso consultar" — isso é falha de competência/completude do prompt, não invenção.
- Quando em dúvida se algo é alucinação, PREFIRA não classificar como alucinação. Alucinação é uma acusação forte e deve ter evidência clara.

MEMÓRIA - VERIFICAÇÃO RIGOROSA:
- O cliente deu seu nome? O agente usou depois? Se não → FALHA
- O cliente explicou sua situação? O agente referenciou? Se não → FALHA
- O agente pediu informação que o cliente JÁ deu? → FALHA GRAVE
- O agente confundiu dados do cliente? → FALHA CRÍTICA

FLUXO - CADA PASSO CONTA:
- Liste TODOS os passos esperados do prompt
- Marque quais foram seguidos e quais não
- Pular um passo = penalização. Inverter ordem = penalização. Repetir desnecessariamente = penalização.

COMPLIANCE DO PROMPT:
- Verifique CADA regra/proibição mencionada no prompt
- O agente usou vocabulário proibido? Violou alguma restrição?
- O agente escalou para humano quando deveria? Ou deixou de escalar?

===== ANÁLISE PROFUNDA DO PROMPT (OBRIGATÓRIA) =====

Você DEVE analisar o prompt original em profundidade e identificar problemas ESTRUTURAIS que causaram os erros do agente:

1. ESTRUTURA E ORGANIZAÇÃO:
   - O prompt tem seções claras? (persona, objetivo, regras, exemplos, escalação)
   - Usa formatação adequada? (markdown, listas, hierarquia)
   - É fácil de ler e seguir?
   - Tem tamanho adequado? (nem muito curto, nem exageradamente longo)

2. CLAREZA E AMBIGUIDADE:
   - Há instruções ambíguas que permitem múltiplas interpretações?
   - Termos técnicos mal definidos?
   - Regras contraditórias?

3. COMPLETUDE:
   - Cobre todos os cenários possíveis? (feliz, triste, confuso, agressivo)
   - Tem regras de escalação claras? (quando transferir para humano)
   - Lida com perguntas fora do escopo?
   - Tem exemplos concretos (few-shot) quando necessário?

4. RESTRIÇÕES E GUARDAS:
   - Define o que o agente NÃO pode fazer?
   - Previne alucinações? (ex: "só use informações deste prompt")
   - Define tom e vocabulário proibido?

5. CONTEXTO E DADOS:
   - Fornece todas as informações necessárias? (produtos, preços, políticas)
   - Os dados estão atualizados e completos?

===== GERAÇÃO DO PROMPT MELHORADO =====

Com base na análise acima, você DEVE gerar uma versão MELHORADA do prompt original (campo improvedPrompt.fullPrompt):

REQUISITOS:
1. Mantenha a essência e objetivo do prompt original
2. Corrija TODOS os problemas identificados em promptAnalysis.weaknesses
3. Remova ambiguidades encontradas em promptAnalysis.ambiguities
4. Adicione instruções faltantes listadas em promptAnalysis.missingInstructions
5. Elimine redundâncias de promptAnalysis.redundancies
6. Use formatação markdown clara (##, ###, **, listas numeradas/com bullets)
7. Organize em seções lógicas: Persona, Objetivo, Regras, Fluxo, Restrições, Escalação, Exemplos
8. Adicione exemplos few-shot quando útil
9. Inclua regras anti-alucinação se necessário
10. Seja ESPECÍFICO - evite instruções vagas

O prompt melhorado deve estar COMPLETO e PRONTO PARA USO. Seria literalmente copiado e colado para substituir o prompt original.`,
      },
      {
        role: 'user',
        content: `CONVERSA COMPLETA DO TESTE:\n\n${conversationText}`,
      },
    ],
  });

  const report = JSON.parse(response.choices[0].message.content);

  // Adiciona stats computadas localmente para precisão
  report.responseTimeAnalysis.averageMs = Math.round(avgTime);
  report.responseTimeAnalysis.minMs = minTime;
  report.responseTimeAnalysis.maxMs = maxTime;
  report.responseTimeAnalysis.medianMs = medianTime;
  report.responseTimeAnalysis.timeouts = timeoutCount;

  return report;
}
