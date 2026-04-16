# Configuração do Supabase para TestadorAI

Este guia descreve como configurar o Supabase como banco de dados para o TestadorAI.

## 1. Criar um Projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Copie as credenciais:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJ...` (sua chave anônima)

## 2. Executar as Migrações SQL

1. No dashboard do Supabase, vá para **SQL Editor**
2. Crie uma nova query
3. Copie todo o conteúdo de `backend/database/schema.sql`
4. Execute a query

Isso irá criar todas as tabelas necessárias:
- `sessions` - Sessões de teste
- `session_configs` - Configurações das sessões
- `messages` - Mensagens enviadas/recebidas
- `responses` - Respostas do agente
- `session_events` - Eventos/histórico
- `reports` - Relatórios finais
- `personas` - Personas dos testes
- `sentiment_analysis` - Análise de sentimento
- `webhook_logs` - Logs de webhooks

## 3. Configurar Variáveis de Ambiente

No arquivo `.env` do backend, adicione:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJ...seu_anon_key_aqui...
```

## 4. Instalar Dependências

```bash
cd backend
npm install
```

## 5. Como Usar a Base de Dados

O serviço de banco de dados está em `src/services/database.service.js` e fornece funções:

### Salvar uma Sessão
```javascript
import { saveSession } from './services/database.service.js';

await saveSession(sessionData);
```

### Salvar uma Mensagem
```javascript
import { saveMessage } from './services/database.service.js';

await saveMessage(sessionId, 'user', 'Olá!');
```

### Salvar uma Resposta
```javascript
import { saveResponse } from './services/database.service.js';

await saveResponse(sessionId, messageId, 'Resposta do agente', {
  model: 'gpt-4',
  promptTokens: 50,
  completionTokens: 100,
  totalTokens: 150,
  responseTimeMs: 2500,
});
```

### Atualizar Status da Sessão
```javascript
import { updateSessionStatus } from './services/database.service.js';

await updateSessionStatus(sessionId, 'running');
```

### Salvar Relatório
```javascript
import { saveReport } from './services/database.service.js';

await saveReport(sessionId, {
  totalMessages: 10,
  successfulMessages: 9,
  failedMessages: 1,
  averageResponseTime: 2500,
  totalTokensUsed: 5000,
  issues: ['Issue 1'],
  recommendations: ['Recomendação 1'],
});
```

## 6. Estrutura de Dados

### Tabela: sessions
Armazena informações das sessões de teste.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único da sessão |
| `agent_whatsapp_number` | VARCHAR | Número WhatsApp do agente |
| `agent_prompt` | TEXT | Prompt/instruções do agente |
| `message_count` | INT | Quantidade de mensagens planejadas |
| `custom_scenario` | TEXT | Cenário customizado (opcional) |
| `external_ref` | VARCHAR | Referência externa para rastreamento |
| `case_data` | JSONB | Dados do caso (optional) |
| `status` | VARCHAR | Status: pending, running, completed, error |
| `persona` | JSONB | Persona do cliente/pessoa |
| `report` | JSONB | Relatório final |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Data de última atualização |
| `completed_at` | TIMESTAMP | Data de conclusão |
| `error_message` | TEXT | Mensagem de erro (se houver) |

### Tabela: messages
Armazena todas as mensagens da conversa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único da mensagem |
| `session_id` | UUID | FK para session |
| `sender` | VARCHAR | 'user' ou 'agent' |
| `content` | TEXT | Conteúdo da mensagem |
| `external_message_id` | VARCHAR | ID externo (Evolution API) |
| `status` | VARCHAR | 'sent', 'delivered', 'failed' |
| `metadata` | JSONB | Dados adicionais |
| `created_at` | TIMESTAMP | Data de criação |

### Tabela: responses
Armazena respostas do agente (com métricas).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único da resposta |
| `session_id` | UUID | FK para session |
| `message_id` | UUID | FK para message |
| `response_text` | TEXT | Texto da resposta |
| `model_used` | VARCHAR | Modelo OpenAI usado (gpt-4, etc) |
| `prompt_tokens` | INT | Tokens do prompt |
| `completion_tokens` | INT | Tokens de conclusão |
| `total_tokens` | INT | Total de tokens |
| `response_time_ms` | INT | Tempo de resposta em ms |
| `temperature` | DECIMAL | Parâmetro temperature |
| `top_p` | DECIMAL | Parâmetro top_p |
| `metadata` | JSONB | Dados adicionais |
| `created_at` | TIMESTAMP | Data de criação |

## 7. Row Level Security (RLS)

Para produção, configure RLS no Supabase:

1. Vá para **Authentication** > **Policies**
2. Habilite RLS nas tabelas
3. Crie políticas de acesso baseadas em seu modelo de segurança

Exemplo básico:
```sql
-- Permitir leitura/escrita próprio projeto
CREATE POLICY "Enable read access for authenticated users" ON sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

## 8. Backups Automáticos

O Supabase oferece backups automáticos. Configure em:
**Project Settings** > **Backups** > **Backup Settings**

## 9. Monitoramento

Use o **SQL Editor** do Supabase para monitorar:

```sql
-- Ver resumo das sessões
SELECT * FROM sessions_summary;

-- Ver performance do agente
SELECT * FROM agent_performance;

-- Ver últimas 10 sessões
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 10;

-- Contar mensagens por sessão
SELECT session_id, COUNT(*) as total FROM messages GROUP BY session_id;
```

## 10. Troubleshooting

### "SUPABASE_URL ou SUPABASE_KEY não configurados"
- Verifique o arquivo `.env` do backend
- Certifique-se de que as variáveis estão definidas

### Erro de conexão
- Verifique se a URL do Supabase está correta
- Confirme que a chave Anon é válida
- Verifique se o projeto Supabase está online

### Tabelas não encontradas
- Garanta que executou o `schema.sql` completo
- Verifique se não há erros na execução do SQL

## 11. Próximos Passos

- Integre as chamadas de banco de dados nos controllers
- Configure webhooks para registrar eventos
- Implemente análise de sentimento
- Configure alertas para erros/falhas

Documentação Supabase: [docs.supabase.com](https://docs.supabase.com)
