import 'server-only'

import { createClient } from '@/lib/supabase/server'

// FONTE ÚNICA de dados comerciais para métricas/relatórios (ARCH-001). Team-scoped. Tudo que é KPI
// (Dashboard, Relatório, Forecast) nasce daqui — nenhuma tela ou PDF consulta/duplica. (Nota de escala:
// hoje lê linhas cruas e agrega no Service; ao crescer, migrar para agregações SQL sem mudar as camadas.)

export type MLead = { id: string; status: string | null; value: number | null; received_at: string | null; created_at: string | null; stage_changed_at: string | null; score: number | null; origem: string | null }
export type MStage = { lead_id: string | null; from_stage: string | null; to_stage: string; changed_at: string }
export type MDeal = { id: string; lead_id: string | null; kind: string | null; valor_total_usd: number | null; status: string | null; data_fechamento: string | null; created_at: string | null }

export type CommercialRaw = {
  leads: MLead[]
  stageEvents: MStage[]
  deals: MDeal[]
}

// withPipeline=true carrega TAMBÉM stage_events (funil/movimentações/gargalos do Relatório). Os consumidores
// executivos (Hall/Dashboard/Financeiro/aba Métricas) usam SÓ leads + deals → não varrem a tabela inteira
// (perf, SPRINT-FINAL-002 Parte 4). Números idênticos: o caminho executivo nunca leu stageEvents.
// A tabela `meetings` saiu daqui: o relatório passou a contar reunião pela transição do funil (stage_events),
// então varrê-la era custo puro. Quem precisa dela é a COMISSÃO, que lê direto.
export async function getCommercialRaw(teamId: string, opts?: { withPipeline?: boolean }): Promise<CommercialRaw> {
  const supabase = createClient()
  const withPipeline = opts?.withPipeline ?? false
  const emptyRes = <T>() => Promise.resolve({ data: [] as T[], error: null })
  const [leads, deals, stageEvents] = await Promise.all([
    supabase.from('leads').select('id, status, value, received_at, created_at, stage_changed_at, score, origem').eq('team_id', teamId),
    supabase.from('deals').select('id, lead_id, kind, valor_total_usd, status, data_fechamento, created_at').eq('team_id', teamId),
    withPipeline ? supabase.from('stage_events').select('lead_id, from_stage, to_stage, changed_at').eq('team_id', teamId) : emptyRes<MStage>(),
  ])
  if (leads.error) throw leads.error
  if (deals.error) throw deals.error
  if (stageEvents.error) throw stageEvents.error
  return {
    leads: (leads.data ?? []) as MLead[],
    stageEvents: (stageEvents.data ?? []) as MStage[],
    deals: (deals.data ?? []) as MDeal[],
  }
}

// ── Fontes ADICIONAIS de receita/vendedor (eram da antiga aba Métricas). Escopadas por RLS (a MESMA
//    leitura que a UI fazia antes); em erro degradam para vazio (a aba mostrava 0, nunca quebrava). ──
export type MPayment = { client_id: string; valor_usd: number; paid_on: string; anulado?: boolean; numero_semana?: number; plano_id?: string | null }
export type MClientSeller = { id: string; assigned_name: string | null }

export async function getClientRevenueForMetrics(): Promise<{ payments: MPayment[]; clients: MClientSeller[] }> {
  const supabase = createClient()
  const [pRes, cRes] = await Promise.all([
    supabase.from('client_payments').select('client_id, valor_usd, paid_on, anulado, numero_semana, plano_id'),
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
  dia_pagamento_semana: number | null
}
export type MPlan = { id: string; nome: string }

export async function getExecutiveClients(teamId: string): Promise<{ clients: MExecClient[]; plans: MPlan[] }> {
  const supabase = createClient()
  const [cRes, pRes] = await Promise.all([
    supabase.from('clients').select('id, name, assigned_name, status, plan_weekly, plano_id, periodicidade, forma_pagamento, start_date, dia_pagamento_semana').eq('team_id', teamId),
    supabase.from('plans').select('id, nome'),
  ])
  return {
    clients: (cRes.data ?? []) as MExecClient[],
    plans: (pRes.data ?? []) as MPlan[],
  }
}

// ── Investimento em marketing (EXECUTIVE-METRICS-005 · Aquisição). Ledger team-scoped, RLS já aplicada.
//    O Service soma/derive CPL, custo por reunião/venda e ROI — o repositório só lê e agrega o bruto. ──
export async function getMarketingInvestment(teamId: string, fromYMD: string, toYMD: string): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('marketing_investments')
    .select('amount_usd')
    .eq('team_id', teamId)
    .gte('spent_on', fromYMD)
    .lte('spent_on', toYMD)
  if (error) return 0
  return (data ?? []).reduce((sum, row) => sum + (Number((row as { amount_usd: number | null }).amount_usd) || 0), 0)
}

// Reuniões REALIZADAS do time, como FATO DE FUNIL: a transição "Reunião Agendada" → "Proposta em Análise"
// registrada em stage_events. É a MESMA definição do ReportingService (ReportKpis.meetingsHeld) — só assim
// "Custo por Reunião" bate com "Reuniões Realizadas" mostradas lado a lado no Dashboard/PDF.
//
// Por que NÃO a tabela `meetings`: aquela linha é artefato de COMISSÃO e só nasce quando a reunião gera
// comissão (MEETINGS_COMMISSION_CUTOFF). Desde jul/2026 nenhuma nasce → o custo-por-reunião ficaria null
// para sempre. Leitura enxuta: 2 colunas, já filtrada no banco pelo par de fases (nada de varrer a tabela).
// Os slugs são de fases PROTEGIDAS (isStageProtected) — estáveis mesmo se a equipe renomear a fase.
export type MMeetingMetric = { lead_id: string | null; changed_at: string }

export async function getMeetingsForMetrics(teamId: string): Promise<MMeetingMetric[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stage_events')
    .select('lead_id, changed_at')
    .eq('team_id', teamId)
    .eq('from_stage', 'reuniao')
    .eq('to_stage', 'proposta')
  if (error) return []
  return (data ?? []) as MMeetingMetric[]
}
