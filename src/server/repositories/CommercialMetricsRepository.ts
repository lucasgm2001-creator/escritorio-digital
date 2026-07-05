import 'server-only'

import { createClient } from '@/lib/supabase/server'

// FONTE ÚNICA de dados comerciais para métricas/relatórios (ARCH-001). Team-scoped. Tudo que é KPI
// (Dashboard, Relatório, Forecast) nasce daqui — nenhuma tela ou PDF consulta/duplica. (Nota de escala:
// hoje lê linhas cruas e agrega no Service; ao crescer, migrar para agregações SQL sem mudar as camadas.)

export type MLead = { id: string; status: string | null; value: number | null; received_at: string | null; created_at: string | null; stage_changed_at: string | null; score: number | null; origem: string | null }
export type MStage = { lead_id: string | null; from_stage: string | null; to_stage: string; changed_at: string }
// met_on = data REAL da reunião (competência para período/timeline); created_at é só quando a linha nasceu no
// banco. CLIENT-HISTORY-ADMIN-003: reunião histórica (met_on retroativo) tem de cair no período certo.
export type MMeeting = { id: string; valor_usd: number | null; met_on: string | null; created_at: string | null }
export type MDeal = { id: string; lead_id: string | null; valor_total_usd: number | null; status: string | null; data_fechamento: string | null; created_at: string | null }

export type CommercialRaw = {
  leads: MLead[]
  stageEvents: MStage[]
  meetings: MMeeting[]
  deals: MDeal[]
}

export async function getCommercialRaw(teamId: string): Promise<CommercialRaw> {
  const supabase = createClient()
  // (Removido o load de `clients` — era DEAD: nenhum consumidor lia raw.clients. CLIENT-HISTORY-ADMIN-003, Parte 5.)
  const [leads, stageEvents, meetings, deals] = await Promise.all([
    supabase.from('leads').select('id, status, value, received_at, created_at, stage_changed_at, score, origem').eq('team_id', teamId),
    supabase.from('stage_events').select('lead_id, from_stage, to_stage, changed_at').eq('team_id', teamId),
    supabase.from('meetings').select('id, valor_usd, met_on, created_at').eq('team_id', teamId),
    supabase.from('deals').select('id, lead_id, valor_total_usd, status, data_fechamento, created_at').eq('team_id', teamId),
  ])
  if (leads.error) throw leads.error
  if (stageEvents.error) throw stageEvents.error
  if (meetings.error) throw meetings.error
  if (deals.error) throw deals.error
  return {
    leads: (leads.data ?? []) as MLead[],
    stageEvents: (stageEvents.data ?? []) as MStage[],
    meetings: (meetings.data ?? []) as MMeeting[],
    deals: (deals.data ?? []) as MDeal[],
  }
}

// ── Fontes ADICIONAIS da aba Métricas (marcos do ciclo + receita/vendedor). Escopadas por RLS (a MESMA
//    leitura que a UI fazia antes); em erro degradam para vazio (a aba mostrava 0, nunca quebrava). ──
export type MMilestone = { lead_id: string; marco: string; achieved_on: string }

export async function getLeadMilestonesForMetrics(): Promise<MMilestone[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lead_milestones')
    .select('lead_id, marco, achieved_on')
    .in('marco', ['reuniao', 'fechou'])
  if (error) return []
  return (data ?? []) as MMilestone[]
}

export type MPayment = { client_id: string; valor_usd: number; paid_on: string; anulado?: boolean; numero_semana?: number }
export type MClientSeller = { id: string; assigned_name: string | null }

export async function getClientRevenueForMetrics(): Promise<{ payments: MPayment[]; clients: MClientSeller[] }> {
  const supabase = createClient()
  const [pRes, cRes] = await Promise.all([
    supabase.from('client_payments').select('client_id, valor_usd, paid_on, anulado, numero_semana'),
    supabase.from('clients').select('id, assigned_name'),
  ])
  return {
    payments: (pRes.data ?? []) as MPayment[],
    clients: (cRes.data ?? []) as MClientSeller[],
  }
}

// ── Carteira de clientes p/ métricas executivas (MRR/ARR, receita por plano, clientes novos, receita prevista).
//    Team-scoped; RLS já exclui soft-deleted. plan_weekly = valor SEMANAL do cliente (custom ou do plano). ──
export type MExecClient = {
  id: string; name: string | null; assigned_name: string | null; status: string | null; plan_weekly: number | null
  plano_id: string | null; periodicidade: string | null; forma_pagamento: string | null; start_date: string | null
  dia_pagamento_semana: number | null; created_at: string | null
}
export type MPlan = { id: string; nome: string }

export async function getExecutiveClients(teamId: string): Promise<{ clients: MExecClient[]; plans: MPlan[] }> {
  const supabase = createClient()
  const [cRes, pRes] = await Promise.all([
    supabase.from('clients').select('id, name, assigned_name, status, plan_weekly, plano_id, periodicidade, forma_pagamento, start_date, dia_pagamento_semana, created_at').eq('team_id', teamId),
    supabase.from('plans').select('id, nome'),
  ])
  return {
    clients: (cRes.data ?? []) as MExecClient[],
    plans: (pRes.data ?? []) as MPlan[],
  }
}
