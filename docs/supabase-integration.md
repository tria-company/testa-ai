# Integração com Supabase — testa-ai

Este documento explica **como** o testa-ai usa o Supabase e **o que** ele grava em cada etapa do ciclo de vida de uma sessão de teste. Existem dois Supabase distintos no sistema:

1. **Supabase do testa-ai** — armazena tudo o que o testa-ai produz (sessões, mensagens, relatórios). É o "banco de operação" do produto.
2. **Supabase do projeto cliente** (ex.: Seu Elias) — banco do agente que está sendo testado. O testa-ai apenas **apaga** dados de teste daqui ao final do teste, **não escreve nada**.

---

## 1. Supabase do testa-ai (banco de operação)

### Conexão

Inicializada uma única vez em [backend/src/services/database.service.js](../backend/src/services/database.service.js) com as variáveis de ambiente:

```
SUPABASE_URL=https://gvbzghfynwtbemhcikqg.supabase.co
SUPABASE_KEY=sb_publishable_P427vWlMbybi7QN_y2-xzg_PEftpZHE

```

Se qualquer uma das duas faltar, o `database.service.js` desabilita a integração e loga um aviso. O sistema continua funcionando — só não persiste nada.

Cliente: `@supabase/supabase-js` (`createClient(url, key)`).

### Tabelas (schema completo em [backend/database/schema.sql](../backend/database/schema.sql))

| Tabela                       | O que guarda                                                              |
|------------------------------|---------------------------------------------------------------------------|
| `testaai_sessions`           | Metadados da sessão de teste (1 linha por teste)                          |
| `testaai_session_configs`    | Configuração técnica da sessão (Evolution URL/instance/key, OpenAI key)   |
| `testaai_messages`           | Cada mensagem trocada (sender = `tester` ou `agent`)                      |
| `testaai_responses`          | Resposta do agente associada à mensagem do tester (com tempo de resposta) |
| `testaai_reports`            | Relatório final gerado pelo GPT (1 linha por teste, upsert)               |
| `testaai_personas`           | Persona criada pelo GPT pra simular o cliente                             |
| `testaai_session_events`     | Histórico de mudanças de status                                           |
| `testaai_webhook_logs`       | Log de payloads recebidos da Evolution API                                |
| `testaai_sentiment_analysis` | Análise de sentimento (atualmente sem uso ativo)                          |

Todas as tabelas têm `ON DELETE CASCADE` em `session_id`, então apagar uma sessão limpa tudo.

---

## 2. O que é salvo, quando, e por qual função

Tudo que o testa-ai grava passa pelos exports de [backend/src/services/database.service.js](../backend/src/services/database.service.js). Abaixo, o ciclo de vida.

### 2.1. `POST /api/test/start` → `saveSession`

**Quando:** logo após `createSession` em [backend/src/models/session.js:48-50](../backend/src/models/session.js#L48-L50).
**O que grava:**

- Em `testaai_sessions`: `id`, `agent_whatsapp_number`, `agent_prompt`, `message_count`, `custom_scenario`, `external_ref`, `case_data`, `status` (= `'pending'`), `persona` (= `null` neste momento).
- Em `testaai_session_configs`: `session_id`, `evolution_api_url`, `evolution_instance_name`, `evolution_api_key`, `openai_api_key`. ⚠️ Chaves API são gravadas em texto plano — proteja o acesso ao Supabase.

A chamada é feita em background via `.catch`, então erro de DB **não bloqueia o teste**.

### 2.2. Cada mensagem do tester → `saveMessage`

**Quando:** após enviar a mensagem via Evolution, em [backend/src/services/conversation.service.js:90-92](../backend/src/services/conversation.service.js#L90-L92).
**O que grava em `testaai_messages`:**

- `session_id`, `sender = 'tester'`, `content`, `external_message_id` (opcional), `status = 'sent'`.

### 2.3. Cada resposta do agente → `saveMessage` + `saveResponse`

**Quando:** quando o webhook da Evolution traz uma resposta ([conversation.service.js:163-174](../backend/src/services/conversation.service.js#L163-L174)).
**O que grava:**

- `testaai_messages`: `sender = 'agent'`, `content` da resposta.
- `testaai_responses` (linkada à mensagem): `response_text`, `response_time_ms`, `model_used = 'agent'`, `metadata` (com tudo que veio).

### 2.4. Persona gerada pelo GPT → `updateSessionPersona`

**Quando:** atualmente esta função existe em `database.service.js` mas **não é chamada automaticamente** pelo fluxo de conversação. A persona fica gravada apenas dentro do JSON `report` (campo `metrics` em `testaai_reports`) ao final, não em uma coluna dedicada de `testaai_sessions`. Se você precisa da persona consultável em SQL, é o ponto a ligar manualmente.

### 2.5. Mudança de status → `updateSessionStatus` + `logSessionEvent`

**Quando:** chamada via `saveReport` ao final (linha 229 de `database.service.js`). Atualiza `testaai_sessions.status`, `completed_at`, `report` (JSON inteiro), e cria um evento em `testaai_session_events`.

### 2.6. Relatório final → `saveReport`

**Quando:** ao terminar o teste, em [backend/src/services/conversation.service.js:257-259](../backend/src/services/conversation.service.js#L257-L259).
**O que grava em `testaai_reports`** (com `upsert` em `session_id`):

- `total_messages`, `successful_messages`, `failed_messages`, `average_response_time_ms`, `total_tokens_used`, `status`, `issues[]`, `recommendations[]`, `metrics` (JSON com **o relatório inteiro** — scores, análises, persona, prompt analysis, prompt melhorado).

Em paralelo, atualiza a sessão como `completed` via `updateSessionStatus`.

### 2.7. Webhook (opcional) → `logWebhook`

Função existe pra logar payloads brutos da Evolution. Não está sendo chamada automaticamente no fluxo atual.

---

## 3. Garantias e padrões

- **Tudo é best-effort.** Toda chamada de DB usa `.catch((err) => console.error(...))` em quem chama. Falha de Supabase nunca derruba o teste.
- **Operação assíncrona.** As escritas não são `await`-adas pelos handlers — sempem sem bloquear o fluxo principal.
- **Idempotência:** `saveReport` usa `upsert` em `session_id`, então re-execuções não duplicam.
- **Retenção:** sessões em memória são limpas após `SESSION_TTL_HOURS` (padrão 6h) — mas no Supabase ficam para sempre até alguém apagar.
- **Sem RLS configurado** no schema atual — o acesso é regido pela `SUPABASE_KEY` (preferir service role apenas no servidor, nunca expor ao frontend).

---

## 4. Limpeza no Supabase do projeto cliente (cleanup pós-teste)

Quando o usuário inicia um teste com `project: "seu-elias"` (ou outro projeto registrado), ao final o testa-ai **apaga** dados de teste no Supabase **do agente** — não no do testa-ai.

### Conexão

Cada projeto cliente é configurado em [backend/src/config.js](../backend/src/config.js) na constante `PROJECTS`:

```js
export const PROJECTS = {
  'seu-elias': {
    label: 'Seu Elias',
    supabaseUrl: process.env.SEU_ELIAS_SUPABASE_URL,
    supabaseKey: process.env.SEU_ELIAS_SUPABASE_KEY,
  },
};
```

O cliente é instanciado sob demanda em [backend/src/services/projects.service.js](../backend/src/services/projects.service.js) e cacheado por chave de projeto.

### Quando roda

`runProjectCleanup(session)` em [backend/src/services/conversation.service.js](../backend/src/services/conversation.service.js) é chamado em:

1. `finally` do `finishTest()` (status final `completed` ou `error` no fluxo de relatório)
2. `else` do `stopTest()` (sessão parada antes de ter conversa suficiente)
3. `catch` do `begin()` (erro logo no início)
4. `catch` do `sendNextMessage()` (erro no envio)

A flag `session._cleanupRan` garante idempotência — só roda 1 vez por sessão.

### O que faz

`cleanupTestLead(projectKey, testerPhone)`:

1. **Descobre o telefone do testador** chamando `GET /instance/fetchInstances` na Evolution API (a instância simula o lead, então o "owner" dela é o número que apareceu como lead pro agente).
2. **Busca lead(s)** com `SELECT id FROM leads WHERE telefone IN (variantes)` (testa com e sem `+`).
3. **Apaga as threads**: `DELETE FROM threads WHERE lead_id IN (...)` e retorna o count.
4. **Loga** quantas threads foram apagadas — ou warning se nada foi encontrado.

### O que **não** apaga

Apenas a tabela `threads` é apagada. O lead em si fica preservado. Outras tabelas do agente (mensagens, oportunidades, contatos GHL) também ficam intocadas. Se um projeto novo precisar de comportamento diferente, basta adicionar uma função de cleanup customizada em `PROJECTS[<projeto>].cleanup` (não implementado ainda — ver "Próximo projeto").

---

## 5. Variáveis de ambiente

| Variável                  | Onde é usada                       | Necessária?            |
|---------------------------|------------------------------------|------------------------|
| `SUPABASE_URL`            | Banco de operação do testa-ai      | Sim (senão DB off)     |
| `SUPABASE_KEY`            | Banco de operação do testa-ai      | Sim (senão DB off)     |
| `SEU_ELIAS_SUPABASE_URL`  | Cleanup pós-teste do Seu Elias     | Só se usar `project`   |
| `SEU_ELIAS_SUPABASE_KEY`  | Cleanup pós-teste do Seu Elias     | Só se usar `project`   |

Em produção, o serviço PM2 precisa ser reiniciado com `--update-env` (ou `delete` + `start`) para o Node enxergar variáveis novas no `.env`.

---

## 6. Próximo projeto

Para integrar um novo projeto cliente (com schema de banco diferente):

1. Adicionar variáveis no `.env`: `<NOME>_SUPABASE_URL`, `<NOME>_SUPABASE_KEY`.
2. Adicionar entrada em `PROJECTS` em `config.js`.
3. Adicionar opção no dropdown em [frontend/src/components/TestForm.jsx](../frontend/src/components/TestForm.jsx) (`PROJECT_OPTIONS`).
4. Adicionar opção `enum` em [backend/src/swagger.js](../backend/src/swagger.js).
5. Se o schema de banco for diferente (não tem `leads.telefone` / `threads.lead_id`), adicionar uma função de cleanup específica no `projects.service.js` e fazer o `cleanupTestLead` rotear pelo `projectKey`.

---

## 7. Resumo visual do fluxo

```
START TEST
  └─ saveSession()            → testaai_sessions, testaai_session_configs
  └─ saveMessage(tester)      → testaai_messages (cada msg do tester)
  └─ saveMessage(agent)       → testaai_messages (cada resposta)
  └─ saveResponse()           → testaai_responses (com response_time_ms)

END TEST (completed | stopped | error)
  └─ saveReport()             → testaai_reports (upsert)
  └─ updateSessionStatus()    → testaai_sessions.status = 'completed'
  └─ logSessionEvent()        → testaai_session_events
  └─ runProjectCleanup()      → DELETE em threads do projeto cliente (se project setado)
```
