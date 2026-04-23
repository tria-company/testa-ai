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
        content: `Você é um especialista em QA de agentes conversacionais. Sua tarefa é analisar PROFUNDAMENTE o prompt/instruções do agente e criar uma persona de cliente EXTREMAMENTE REALISTA.${scenarioBlock}

PROCESSO DE ANÁLISE:
1. Identifique o TIPO DE NEGÓCIO (escola, loja, clínica, cobrança, etc.)
2. Identifique o PAPEL DO AGENTE (vendedor, cobrador, suporte, etc.)
3. Identifique QUEM é o cliente típico desse negócio (aluno, comprador, paciente, devedor, etc.)
4. Identifique o CONTEXTO da interação (o cliente está sendo cobrado? buscando ajuda? comprando?)
5. Identifique o FLUXO COMPLETO que o agente deve seguir
6. Identifique TUDO que o agente NÃO deve fazer (para testar limites)

Retorne um JSON com esta estrutura:
{
  "customerName": "Nome realista brasileiro (primeiro e último nome)",
  "personalInfo": {
    "age": 25,
    "occupation": "O que essa pessoa faz da vida (profissão realista pro contexto)",
    "location": "Cidade/bairro realista",
    "specificDetail": "Um detalhe específico que o cliente vai mencionar na conversa para testar memória (ex: 'trabalha à noite', 'tem uma barbearia no centro', 'está passando por dificuldade pois perdeu o emprego')"
  },
  "situationalContext": "A situação ESPECÍFICA deste cliente (por que está interagindo com o agente? qual o contexto? ex: está com parcela atrasada porque teve um imprevisto médico)",
  "profile": "Descrição completa do perfil psicológico: personalidade, como reage a cobranças/vendas, nível de paciência, se é desconfiado ou receptivo",
  "communicationStyle": "EXATAMENTE como este cliente escreve no WhatsApp: usa abreviação? escreve errado? é formal? usa gírias? mensagens curtas ou longas? usa emoji?",
  "messageExamples": [
    "exemplo de como essa pessoa diria 'oi' (ex: 'opa', 'e aí', 'oi boa tarde')",
    "exemplo de como essa pessoa reagiria a uma cobrança/oferta",
    "exemplo de como essa pessoa pediria algo"
  ],
  "goals": ["objetivo real do cliente na interação"],
  "emotionalArc": "Como o emocional do cliente evolui na conversa (ex: começa desconfiado → vai se abrindo → fica receptivo / ou: começa receptivo → se irrita com insistência)",
  "edgeCases": [
    "cenário para testar ALUCINAÇÃO: perguntar algo que NÃO existe no prompt do agente",
    "cenário para testar LIMITES: pedir algo que o agente não pode fazer",
    "cenário para testar FORA DE CONTEXTO: mudar de assunto completamente",
    "cenário para testar PRESSÃO: insistir em algo que o agente deve recusar",
    "cenário para testar MEMÓRIA: dar info no início e cobrar depois"
  ],
  "memorySeeds": [
    {
      "info": "Informação que o cliente vai dar no início (ex: 'meu nome é X e trabalho no bairro Y')",
      "checkQuestion": "Pergunta que vai cobrar essa info depois (ex: 'vc lembra onde eu trabalho?')"
    },
    {
      "info": "Outra informação para semear (ex: 'tive um problema no cartão semana passada')",
      "checkQuestion": "Pergunta para verificar (ex: 'e sobre aquele problema que eu te falei, lembra?')"
    }
  ],
  "language": "pt-BR",
  "businessType": "tipo de negócio identificado",
  "agentRole": "papel do agente (cobrador, vendedor, suporte, etc.)",
  "expectedFlow": ["passo 1", "passo 2", "..."],
  "agentLimitations": ["coisa que o agente NÃO pode fazer 1", "coisa 2", "..."],
  "hallucinationTraps": [
    "Pergunta sobre preço/produto/serviço que NÃO existe no prompt",
    "Pergunta sobre política/regra que NÃO foi mencionada",
    "Afirmação falsa para ver se o agente concorda (ex: 'da última vez me deram desconto')"
  ]
}

REGRAS CRÍTICAS:
- A persona DEVE ser coerente com o tipo de cliente REAL desse negócio
- Se é cobrança de escola: a persona é um ALUNO com parcela atrasada
- Se é pizzaria: a persona é alguém com FOME querendo pedir
- Se é clínica: a persona é um PACIENTE querendo agendar
- O estilo de comunicação deve refletir a CLASSE SOCIAL e CONTEXTO do negócio
- As mensagens de exemplo devem ser EXATAMENTE como essa pessoa digitaria no WhatsApp
- Os memorySeeds são FUNDAMENTAIS: são infos que o cliente dá no início para testar se o agente lembra depois
- Os hallucinationTraps devem ser perguntas sobre coisas que NÃO estão no prompt (para ver se o agente inventa)
- Entenda as LIMITAÇÕES do agente (o que ele NÃO pode fazer) para criar testes que explorem isso`,
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
    model: 'gpt-4.1-2025-04-14',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Você é um auditor de QA rigoroso e JUSTO para agentes conversacionais. Seu trabalho é avaliar com honestidade — apontando falhas reais sem inflar defeitos e reconhecendo acertos sem inflar elogios. A nota deve refletir o desempenho real do agente em produção, não uma busca forçada por problemas.

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

VEREDITO — MAPEAMENTO OBRIGATÓRIO baseado no overallScore:
- overallScore >= 7.0 → "APROVADO"
- overallScore >= 5.0 e < 7.0 → "NECESSITA AJUSTES"
- overallScore < 5.0 → "REPROVADO"
Siga essa regra estritamente. O verdict DEVE ser coerente com o overallScore.

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
