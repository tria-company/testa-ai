-- TestadorAI Supabase Schema
-- Crie estas tabelas no seu projeto Supabase

-- Tabela de Sessões
CREATE TABLE testaai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_whatsapp_number VARCHAR(20) NOT NULL,
  agent_prompt TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  custom_scenario TEXT,
  external_ref VARCHAR(100),
  case_data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  persona JSONB,
  report JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_sessions_status ON testaai_sessions(status);
CREATE INDEX idx_sessions_agent_number ON testaai_sessions(agent_whatsapp_number);
CREATE INDEX idx_sessions_external_ref ON testaai_sessions(external_ref);
CREATE INDEX idx_sessions_created_at ON testaai_sessions(created_at);

-- Tabela de Configurações de Sessão
CREATE TABLE testaai_session_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  evolution_api_url VARCHAR(255) NOT NULL,
  evolution_instance_name VARCHAR(255) NOT NULL,
  evolution_api_key VARCHAR(255) NOT NULL,
  openai_api_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_configs_session_id ON testaai_session_configs(session_id);

-- Tabela de Mensagens
CREATE TABLE testaai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL, -- 'user' ou 'agent'
  content TEXT NOT NULL,
  external_message_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON testaai_messages(session_id);
CREATE INDEX idx_messages_sender ON testaai_messages(sender);
CREATE INDEX idx_messages_created_at ON testaai_messages(created_at);
CREATE INDEX idx_messages_status ON testaai_messages(status);

-- Tabela de Respostas do Agente
CREATE TABLE testaai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES testaai_messages(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  model_used VARCHAR(100), -- 'gpt-4', 'gpt-4-turbo', etc
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_time_ms INTEGER,
  temperature DECIMAL(3, 2),
  top_p DECIMAL(3, 2),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_responses_session_id ON testaai_responses(session_id);
CREATE INDEX idx_responses_message_id ON testaai_responses(message_id);
CREATE INDEX idx_responses_created_at ON testaai_responses(created_at);

-- Tabela de Eventos da Sessão (para rastrear mudanças de status)
CREATE TABLE testaai_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'status_change', 'message_sent', 'error', etc
  event_data JSONB,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_events_session_id ON testaai_session_events(session_id);
CREATE INDEX idx_session_events_type ON testaai_session_events(event_type);
CREATE INDEX idx_session_events_created_at ON testaai_session_events(created_at);

-- Tabela de Relatórios
CREATE TABLE testaai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  total_messages INTEGER,
  successful_messages INTEGER,
  failed_messages INTEGER,
  average_response_time_ms DECIMAL(10, 2),
  total_tokens_used INTEGER,
  status VARCHAR(50),
  issues TEXT[],
  recommendations TEXT[],
  metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_session_id ON testaai_reports(session_id);
CREATE INDEX idx_reports_created_at ON testaai_reports(created_at);

-- Tabela de Personas (para reutilização)
CREATE TABLE testaai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  name VARCHAR(255),
  characteristics JSONB,
  behavior_pattern TEXT,
  conversation_style JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_personas_session_id ON testaai_personas(session_id);

-- Tabela de Análise de Sentimento (opcional, para relatórios)
CREATE TABLE testaai_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES testaai_messages(id) ON DELETE CASCADE,
  sentiment VARCHAR(50), -- 'positive', 'negative', 'neutral'
  confidence DECIMAL(3, 2),
  emotions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sentiment_message_id ON testaai_sentiment_analysis(message_id);

-- Tabela de Webhooks/Logs
CREATE TABLE testaai_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES testaai_sessions(id) ON DELETE CASCADE,
  webhook_type VARCHAR(100),
  payload JSONB,
  response_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_session_id ON testaai_webhook_logs(session_id);
CREATE INDEX idx_webhook_logs_created_at ON testaai_webhook_logs(created_at);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON testaai_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER messages_updated_at BEFORE UPDATE ON testaai_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views úteis
CREATE VIEW sessions_summary AS
SELECT
  s.id,
  s.agent_whatsapp_number,
  s.external_ref,
  s.status,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT r.id) as response_count,
  s.created_at,
  s.completed_at
FROM testaai_sessions s
LEFT JOIN testaai_messages m ON s.id = m.session_id
LEFT JOIN testaai_responses r ON s.id = r.session_id
GROUP BY s.id;

CREATE VIEW agent_performance AS
SELECT
  s.id as session_id,
  s.agent_whatsapp_number,
  COUNT(m.id) as total_messages,
  SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
  AVG(r.response_time_ms) as avg_response_time,
  SUM(r.total_tokens) as total_tokens_used,
  s.status,
  s.created_at
FROM testaai_sessions s
LEFT JOIN testaai_messages m ON s.id = m.session_id
LEFT JOIN testaai_responses r ON s.id = r.session_id
GROUP BY s.id, s.agent_whatsapp_number;
