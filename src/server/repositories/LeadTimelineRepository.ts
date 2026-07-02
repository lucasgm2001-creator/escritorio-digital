import 'server-only'

import { createClient } from '@/lib/supabase/server'

// Fontes brutas da timeline do lead (ARCH-001, Data Access Layer). Filtram por lead_id — a isolação de
// equipe é garantida ANTES, no LeadHubService (que confere lead.team_id === activeTeamId). Assim os
// registros-filho herdam a tenancy do lead, sem depender do team_id de cada tabela-filha.

export type InteractionRow = { id: string; type: string; note: string | null; created_by_name: string | null; created_at: string | null }
export type StageEventRow = { id: string; from_stage: string | null; to_stage: string; seller_name: string | null; changed_at: string }
export type MeetingRow = { id: string; note: string | null; met_on: string | null; created_at: string | null }
export type DealRow = { id: string; valor_total_usd: number; status: string; data_fechamento: string | null; created_at: string | null }
export type ActivityRow = { id: string; type: string; description: string; user_name: string | null; created_at: string | null }

export async function getInteractions(leadId: string): Promise<InteractionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lead_interactions')
    .select('id, type, note, created_by_name, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as InteractionRow[]
}

export async function getStageEvents(leadId: string): Promise<StageEventRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stage_events')
    .select('id, from_stage, to_stage, seller_name, changed_at')
    .eq('lead_id', leadId)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as StageEventRow[]
}

export async function getMeetings(leadId: string): Promise<MeetingRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('meetings')
    .select('id, note, met_on, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MeetingRow[]
}

export async function getDeals(leadId: string): Promise<DealRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deals')
    .select('id, valor_total_usd, status, data_fechamento, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DealRow[]
}

export async function getActivities(leadId: string): Promise<ActivityRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, description, user_name, created_at')
    .eq('entity_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ActivityRow[]
}

// Cria uma OBSERVAÇÃO (type='nota'). Mesmo shape do fluxo existente (LeadDiary): team_id e created_at
// vêm dos defaults do banco — nada de lógica de score aqui (observação pura, score_delta = 0).
export async function addObservation(input: {
  leadId: string
  note: string
  createdBy: string
  createdByName: string | null
}): Promise<InteractionRow> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lead_interactions')
    .insert({
      lead_id: input.leadId,
      type: 'nota',
      note: input.note,
      score_delta: 0,
      created_by: input.createdBy,
      created_by_name: input.createdByName,
    })
    .select('id, type, note, created_by_name, created_at')
    .single()
  if (error) throw error
  return data as InteractionRow
}
