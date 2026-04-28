import { createClient } from '@supabase/supabase-js';
import { PROJECTS } from '../config.js';

const clientCache = new Map();

export function isValidProject(projectKey) {
  return typeof projectKey === 'string' && Object.prototype.hasOwnProperty.call(PROJECTS, projectKey);
}

export function listProjectKeys() {
  return Object.keys(PROJECTS);
}

function getProjectClient(projectKey) {
  if (!isValidProject(projectKey)) return null;

  if (clientCache.has(projectKey)) return clientCache.get(projectKey);

  const { supabaseUrl, supabaseKey } = PROJECTS[projectKey];
  if (!supabaseUrl || !supabaseKey) {
    console.warn(`[ProjectCleanup] Projeto "${projectKey}" sem SUPABASE_URL/KEY configurados — pulando.`);
    return null;
  }

  const client = createClient(supabaseUrl, supabaseKey);
  clientCache.set(projectKey, client);
  return client;
}

function buildPhoneVariants(rawPhone) {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return [];
  const variants = new Set([digits, `+${digits}`]);
  return [...variants];
}

export async function cleanupTestLead(projectKey, testerPhone) {
  const client = getProjectClient(projectKey);
  if (!client) return { skipped: true };

  const variants = buildPhoneVariants(testerPhone);
  if (variants.length === 0) {
    console.warn(`[ProjectCleanup] Telefone do testador vazio — pulando limpeza para projeto "${projectKey}".`);
    return { skipped: true };
  }

  const { data: leads, error: leadErr } = await client
    .from('leads')
    .select('id')
    .in('telefone', variants);

  if (leadErr) {
    console.error(`[ProjectCleanup] Erro ao buscar lead em "${projectKey}" para ${testerPhone}:`, leadErr.message);
    return { error: leadErr };
  }

  if (!leads || leads.length === 0) {
    console.log(`[ProjectCleanup] Nenhum lead encontrado em "${projectKey}" para telefone ${testerPhone}.`);
    return { leadsFound: 0, threadsDeleted: 0 };
  }

  const leadIds = leads.map((l) => l.id);

  const { data: deleted, error: delErr } = await client
    .from('threads')
    .delete()
    .in('lead_id', leadIds)
    .select('id');

  if (delErr) {
    console.error(`[ProjectCleanup] Erro ao apagar threads em "${projectKey}" (leads ${leadIds.join(',')}):`, delErr.message);
    return { leadsFound: leadIds.length, error: delErr };
  }

  const count = deleted?.length || 0;
  console.log(`[ProjectCleanup] Apagadas ${count} thread(s) do(s) lead(s) [${leadIds.join(', ')}] no projeto "${projectKey}".`);
  return { leadsFound: leadIds.length, threadsDeleted: count };
}
