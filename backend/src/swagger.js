export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'TestadorAI API',
    version: '1.1.0',
    description: 'API para teste automatizado de agentes conversacionais WhatsApp via Evolution API + GPT-4.1.',
  },
  servers: [
    { url: '/', description: 'Servidor local' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API Key definida em TESTA_AI_API_KEY. Opcional quando a env var não está configurada.',
      },
    },
    schemas: {
      StartTestRequest: {
        type: 'object',
        required: [
          'agentWhatsappNumber',
          'agentPrompt',
          'messageCount',
          'evolutionApiUrl',
          'evolutionInstanceName',
          'evolutionApiKey',
          'openaiApiKey',
        ],
        properties: {
          agentWhatsappNumber: { type: 'string', example: '5511999999999', description: 'Número WhatsApp do agente a ser testado' },
          agentPrompt: { type: 'string', example: 'Você é uma SDR da empresa X...', description: 'Prompt/instruções do agente' },
          messageCount: { type: 'integer', example: 15, description: 'Quantidade de mensagens que o cliente simulado vai enviar' },
          customScenario: { type: 'string', maxLength: 2000, nullable: true, description: 'Cenário customizado para guiar a geração da persona (opcional)', example: 'Lead frio com objeção de preço' },
          externalRef: { type: 'string', maxLength: 100, nullable: true, description: 'Referência externa para rastreamento pelo orquestrador (opcional)', example: 'clickup-subtask-abc123' },
          evolutionApiUrl: { type: 'string', example: 'https://evo.example.com', description: 'URL base da Evolution API' },
          evolutionInstanceName: { type: 'string', example: 'tester-01', description: 'Nome da instância na Evolution API' },
          evolutionApiKey: { type: 'string', example: 'evo-key-xxx', description: 'API Key da Evolution API' },
          openaiApiKey: { type: 'string', example: 'sk-xxx', description: 'API Key da OpenAI' },
          project: {
            type: 'string',
            enum: ['seu-elias'],
            nullable: true,
            description: 'Projeto cliente. Se preenchido, ao finalizar o teste o sistema apaga o lead/threads do testador no Supabase do projeto. Vazio = sem limpeza.',
            example: 'seu-elias',
          },
        },
      },
      StartTestResponse: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid', description: 'ID da sessão criada' },
          externalRef: { type: 'string', nullable: true, description: 'Referência externa (echo do request)' },
        },
      },
      SessionSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'configuring_webhook', 'running', 'generating_report', 'completed', 'stopped', 'error'] },
          agentNumber: { type: 'string' },
          externalRef: { type: 'string', nullable: true },
          messagesRemaining: { type: 'integer' },
          createdAt: { type: 'integer', description: 'Timestamp Unix em ms' },
        },
      },
      ListSessionsResponse: {
        type: 'object',
        properties: {
          sessions: { type: 'array', items: { $ref: '#/components/schemas/SessionSummary' } },
          total: { type: 'integer' },
        },
      },
      StopTestResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          status: { type: 'string' },
          report: { type: 'object', nullable: true, description: 'Relatório parcial (se houve conversa suficiente)' },
        },
      },
      TunnelInfo: {
        type: 'object',
        properties: {
          url: { type: 'string', nullable: true },
          webhookEndpoint: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['connected', 'connecting'] },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/api/test/start': {
      post: {
        tags: ['Testes'],
        summary: 'Iniciar um teste',
        description: 'Cria uma sessão de teste e inicia a simulação de conversa em background. Retorna 202 imediatamente.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StartTestRequest' },
            },
          },
        },
        responses: {
          202: {
            description: 'Teste iniciado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StartTestResponse' } } },
          },
          400: {
            description: 'Campos obrigatórios ausentes ou validação falhou',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/test/list': {
      get: {
        tags: ['Testes'],
        summary: 'Listar sessões',
        description: 'Retorna todas as sessões em memória, com filtros opcionais.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'configuring_webhook', 'running', 'generating_report', 'completed', 'stopped', 'error'] }, description: 'Filtrar por status' },
          { name: 'externalRef', in: 'query', schema: { type: 'string' }, description: 'Filtrar por referência externa exata' },
        ],
        responses: {
          200: {
            description: 'Lista de sessões',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ListSessionsResponse' } } },
          },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/test/{id}/status': {
      get: {
        tags: ['Testes'],
        summary: 'Stream SSE de status',
        description: 'Abre uma conexão Server-Sent Events com eventos: snapshot, status, message, persona, report, error. Cada evento inclui externalRef quando presente.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'ID da sessão' },
          { name: 'token', in: 'query', schema: { type: 'string' }, description: 'API Key alternativa (para EventSource que não suporta headers)' },
        ],
        responses: {
          200: { description: 'Stream SSE aberto', content: { 'text/event-stream': {} } },
          404: { description: 'Sessão não encontrada' },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/test/{id}/stop': {
      post: {
        tags: ['Testes'],
        summary: 'Parar um teste',
        description: 'Para a execução de um teste em andamento. Se houver conversa suficiente (2+ mensagens do agente), gera relatório parcial.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'ID da sessão' },
        ],
        responses: {
          200: {
            description: 'Teste parado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StopTestResponse' } } },
          },
          400: { description: 'Teste não está rodando' },
          404: { description: 'Sessão não encontrada' },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/test/{id}/report': {
      get: {
        tags: ['Testes'],
        summary: 'Obter relatório',
        description: 'Retorna o relatório completo do teste. Inclui externalRef no response.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'ID da sessão' },
        ],
        responses: {
          200: { description: 'Relatório completo (JSON estruturado com scores, análises e recomendações)' },
          404: { description: 'Sessão ou relatório não encontrado' },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/tunnel': {
      get: {
        tags: ['Infraestrutura'],
        summary: 'Info do túnel/webhook',
        description: 'Retorna a URL pública do webhook (ngrok ou manual).',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Info do túnel',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TunnelInfo' } } },
          },
          401: { description: 'API Key inválida ou ausente' },
        },
      },
    },
    '/api/webhook/evolution': {
      post: {
        tags: ['Webhook'],
        summary: 'Webhook da Evolution API',
        description: 'Recebe eventos MESSAGES_UPSERT da Evolution API. Não protegido por auth.',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: { description: 'Evento recebido' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Infraestrutura'],
        summary: 'Health check',
        description: 'Verifica se o servidor está rodando. Não protegido por auth.',
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } },
          },
        },
      },
    },
  },
};
