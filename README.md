# TestadorAI

Testador de agentes conversacionais WhatsApp. Backend Node.js + Express que simula clientes via GPT-4.1 e avalia o desempenho do agente.

## Setup

```bash
cd backend
npm install
cp .env.example .env  # configure as variáveis
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Variáveis de ambiente (backend)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `PORT` | Não | `3001` | Porta do servidor |
| `FRONTEND_URL` | Não | `http://localhost:5173` | URL do frontend (CORS) |
| `NGROK_AUTH_TOKEN` | Não | — | Token do ngrok para túnel público |
| `WEBHOOK_BASE_URL` | Não | — | URL base manual para webhooks (alternativa ao ngrok) |
| `TESTA_AI_API_KEY` | Não | — | Quando definida, todos os endpoints (exceto webhook e health) exigem `Authorization: Bearer <key>` |
| `SESSION_TTL_HOURS` | Não | `6` | Horas até sessões terminadas serem removidas da memória |

## Variáveis de ambiente (frontend)

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `VITE_TESTA_AI_API_KEY` | Não | — | API key para autenticação com o backend (deve ser igual a `TESTA_AI_API_KEY` do backend) |

## API

### POST /api/test/start

Inicia um teste. Retorna `202` com `{ sessionId, externalRef }`.

**Body:**
- `agentWhatsappNumber` (string, obrigatório)
- `agentPrompt` (string, obrigatório)
- `messageCount` (number, obrigatório)
- `evolutionApiUrl` (string, obrigatório)
- `evolutionInstanceName` (string, obrigatório)
- `evolutionApiKey` (string, obrigatório)
- `openaiApiKey` (string, obrigatório)
- `customScenario` (string, opcional, max 2000 chars) — cenário customizado para a persona
- `externalRef` (string, opcional, max 100 chars) — referência externa para rastreamento

### GET /api/test/list

Lista sessões em memória. Query params opcionais: `status`, `externalRef`.

### GET /api/test/:id/status

SSE stream com eventos: `snapshot`, `status`, `message`, `persona`, `report`, `error`.

### POST /api/test/:id/stop

Para um teste em execução.

### GET /api/test/:id/report

Retorna o relatório completo do teste.

### POST /api/webhook/evolution

Webhook da Evolution API (não protegido por auth).

### GET /health

Health check (não protegido por auth).
