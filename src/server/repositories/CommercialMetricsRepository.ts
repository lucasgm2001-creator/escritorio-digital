import 'server-only'

import { createClient } from '@/lib/supabase/server'

// FONTE ÚNICA de dados comerciais para métricas/relatórios (ARCH-001). Team-scoped. Tudo que é KPI
// (Dashboard, Relatório, Forecast) nasce daqui — nenhuma tela ou PDF consulta/duplica. (Nota de escala:
// hoje lê linhas cruas e agrega no Service; ao crescer, migrar para agregações SQL sem mudar as camadas.)

export type MLead = { id: string; status: string | null; value: number | null; received_at: string | null; created_at: string | null; stage_changed_at: string | null }
export type MStage = { lead_id: string | null; from_stage: string | null; to_stage: string; changed_at: string }
export type MMeeting = { id: string; valor_usd: number | null; created_at: string | null }
export type MDeal = { id: string; lead_id: string | null; valor_total_usd: number | null; status: string | null; data_fechamento: string | null; created_at: string | null }
export type MClient = { id: string; created_at: string | null }

export type CommercialRaw = {
  leads: MLead[]
  stageEvents: MStage[]
  meetings: MMeeting[]
  deals: MDeal[]
  clients: MClient[]
}

export async function getCommercialRaw(teamId: string): Promise<CommercialRaw> {
  const supabase = createClient()
  const [leads, stageEvents, meetings, deals, clients] = await Promise.all([
    supabase.from('leads').select('id, status, value, received_at, created_at, stage_changed_at').eq('team_id', teamId),
    supabase.from('stage_events').select('lead_id, from_stage, to_stage, changed_at').eq('team_id', teamId),
    supabase.from('meetings').select('id, valor_usd, created_at').eq('team_id', teamId),
    supabase.from('deals').select('id, lead_id, valor_total_usd, status, data_fechamento, created_at').eq('team_id', teamId),
    supabase.from('clients').select('id, created_at').eq('team_id', teamId),
  ])
  if (leads.error) throw leads.error
  if (stageEvents.error) throw stageEvents.error
  if (meetings.error) throw meetings.error
  if (deals.error) throw deals.error
  if (clients.error) throw clients.error
  return {
    leads: (leads.data ?? []) as MLead[],
    stageEvents: (stageEvents.data ?? []) as MStage[],
    meetings: (meetings.data ?? []) as MMeeting[],
    deals: (deals.data ?? []) as MDeal[],
    clients: (clients.data ?? []) as MClient[],
  }
}
