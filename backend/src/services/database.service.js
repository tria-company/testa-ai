import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL ou SUPABASE_KEY não configurados. Database desabilitado.');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function saveSession(sessionData) {
  if (!supabase) {
    console.error('[Database] SUPABASE NÃO ESTÁ CONFIGURADO!', { supabaseUrl: process.env.SUPABASE_URL?.slice(0, 20), hasKey: !!process.env.SUPABASE_KEY });
    return null;
  }

  try {
    console.log('[Database] Salvando sessão:', sessionData.id);
    const { data, error } = await supabase
      .from('testaai_sessions')
      .insert([{
        id: sessionData.id,
        agent_whatsapp_number: sessionData.config.agentWhatsappNumber,
        agent_prompt: sessionData.config.agentPrompt,
        message_count: sessionData.config.messageCount,
        custom_scenario: sessionData.config.customScenario || null,
        external_ref: sessionData.config.externalRef || null,
        case_data: sessionData.config.caseData || null,
        project: sessionData.config.project || null,
        status: sessionData.status,
        persona: sessionData.persona || null,
      }])
      .select();

    if (error) {
      console.error('[Database] Erro ao salvar sessão:', error);
      return null;
    }

    console.log('[Database] Sessão salva com sucesso:', data?.[0]?.id);
    // Salvar configuração de sessão
    await supabase
      .from('testaai_session_configs')
      .insert([{
        session_id: sessionData.id,
        evolution_api_url: sessionData.config.evolutionApiUrl,
        evolution_instance_name: sessionData.config.evolutionInstanceName,
        evolution_api_key: sessionData.config.evolutionApiKey,
        openai_api_key: sessionData.config.openaiApiKey,
      }]);

    return data?.[0];
  } catch (err) {
    console.error('Erro ao salvar sessão:', err.message);
    return null;
  }
}

export async function updateSessionStatus(sessionId, status, data = {}) {
  if (!supabase) return null;

  try {
    const updateData = { status, ...data };
    if (data.completed) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: result, error } = await supabase
      .from('testaai_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select();

    if (error) {
      console.error('Erro ao atualizar status da sessão:', error);
      return null;
    }

    // Registrar evento
    await logSessionEvent(sessionId, 'status_change', {}, status);

    return result?.[0];
  } catch (err) {
    console.error('Erro ao atualizar status:', err.message);
    return null;
  }
}

export async function saveMessage(sessionId, sender, content, externalMessageId = null) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('testaai_messages')
      .insert([{
        session_id: sessionId,
        sender,
        content,
        external_message_id: externalMessageId,
        status: 'sent',
      }])
      .select();

    if (error) {
      console.error('Erro ao salvar mensagem:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err.message);
    return null;
  }
}

export async function saveResponse(sessionId, messageId, responseText, responseMetadata = {}) {
  if (!supabase) return null;

  try {
    const {
      model = 'gpt-4',
      promptTokens = 0,
      completionTokens = 0,
      totalTokens = 0,
      responseTimeMs = 0,
      temperature = 0.7,
      topP = 1,
    } = responseMetadata;

    const { data, error } = await supabase
      .from('testaai_responses')
      .insert([{
        session_id: sessionId,
        message_id: messageId,
        response_text: responseText,
        model_used: model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        response_time_ms: responseTimeMs,
        temperature: temperature,
        top_p: topP,
        metadata: responseMetadata,
      }])
      .select();

    if (error) {
      console.error('Erro ao salvar resposta:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Erro ao salvar resposta:', err.message);
    return null;
  }
}

export async function updateSessionPersona(sessionId, persona) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('testaai_sessions')
      .update({ persona })
      .eq('id', sessionId)
      .select();

    if (error) {
      console.error('Erro ao atualizar persona:', error);
      return null;
    }

    // Salvar persona na tabela separada também
    await supabase
      .from('testaai_personas')
      .insert([{
        session_id: sessionId,
        name: persona?.name,
        characteristics: persona?.characteristics || null,
        behavior_pattern: persona?.behaviorPattern || null,
        conversation_style: persona?.conversationStyle || null,
      }]);

    return data?.[0];
  } catch (err) {
    console.error('Erro ao atualizar persona:', err.message);
    return null;
  }
}

export async function saveReport(sessionId, report) {
  if (!supabase) return null;

  try {
    const {
      totalMessages = 0,
      successfulMessages = 0,
      failedMessages = 0,
      averageResponseTime = 0,
      totalTokensUsed = 0,
      status = 'completed',
      issues = [],
      recommendations = [],
    } = report;

    const { data, error } = await supabase
      .from('testaai_reports')
      .upsert([{
        session_id: sessionId,
        total_messages: totalMessages,
        successful_messages: successfulMessages,
        failed_messages: failedMessages,
        average_response_time_ms: averageResponseTime,
        total_tokens_used: totalTokensUsed,
        status,
        issues,
        recommendations,
        metrics: report,
      }], { onConflict: 'session_id' })
      .select();

    if (error) {
      console.error('Erro ao salvar relatório:', error);
      return null;
    }

    // Atualizar status da sessão também
    await updateSessionStatus(sessionId, 'completed', { report });

    return data?.[0];
  } catch (err) {
    console.error('Erro ao salvar relatório:', err.message);
    return null;
  }
}

export async function logSessionEvent(sessionId, eventType, eventData = {}, newStatus = null) {
  if (!supabase) return null;

  try {
    const { error } = await supabase
      .from('testaai_session_events')
      .insert([{
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
        new_status: newStatus,
      }]);

    if (error) {
      console.error('Erro ao registrar evento:', error);
    }
  } catch (err) {
    console.error('Erro ao registrar evento:', err.message);
  }
}

export async function logWebhook(sessionId, webhookType, payload, responseStatus, error = null) {
  if (!supabase) return null;

  try {
    const { data, err } = await supabase
      .from('testaai_webhook_logs')
      .insert([{
        session_id: sessionId,
        webhook_type: webhookType,
        payload,
        response_status: responseStatus,
        error_message: error,
      }]);

    if (err) {
      console.error('Erro ao registrar webhook:', err);
    }
  } catch (err) {
    console.error('Erro ao registrar webhook:', err.message);
  }
}

export async function getSessionWithMessages(sessionId) {
  if (!supabase) return null;

  try {
    const { data: session, error: sessionError } = await supabase
      .from('testaai_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Erro ao buscar sessão:', sessionError);
      return null;
    }

    const { data: messages, error: messagesError } = await supabase
      .from('testaai_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
    }

    const { data: responses, error: responsesError } = await supabase
      .from('testaai_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (responsesError) {
      console.error('Erro ao buscar respostas:', responsesError);
    }

    return {
      session,
      messages: messages || [],
      responses: responses || [],
    };
  } catch (err) {
    console.error('Erro ao buscar sessão com mensagens:', err.message);
    return null;
  }
}

export async function getSessionStats(sessionId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .rpc('get_session_stats', { p_session_id: sessionId });

    if (error) {
      console.error('Erro ao buscar stats:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Erro ao buscar stats:', err.message);
    return null;
  }
}

export function isDatabaseConnected() {
  return supabase !== null;
}

export default {
  saveSession,
  updateSessionStatus,
  saveMessage,
  saveResponse,
  updateSessionPersona,
  saveReport,
  logSessionEvent,
  logWebhook,
  getSessionWithMessages,
  getSessionStats,
  isDatabaseConnected,
};
