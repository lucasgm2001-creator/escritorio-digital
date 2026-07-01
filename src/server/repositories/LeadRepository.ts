import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type LeadRecord = Record<string, unknown> & {
  id: string
  team_id?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type LeadCreateInput = Record<string, unknown>
export type LeadUpdateInput = Record<string, unknown>

// Data Access Layer puro para leads. Regras de negocio, permissoes e efeitos
// colaterais pertencem ao CommercialService, nao ao repository.

export async function getLeadById(leadId: string): Promise<LeadRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (error) throw error

  return data as LeadRecord | null
}

export async function getLeadsByTeam(teamId: string): Promise<LeadRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('team_id', teamId)
    .order('score', { ascending: false })

  if (error) throw error

  return (data ?? []) as LeadRecord[]
}

export async function createLead(input: LeadCreateInput): Promise<LeadRecord> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('leads')
    .insert(input)
    .select('*')
    .single()

  if (error) throw error

  return data as LeadRecord
}

export async function updateLead(
  leadId: string,
  patch: LeadUpdateInput,
): Promise<LeadRecord> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) throw error

  return data as LeadRecord
}

export async function deleteLead(leadId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) throw error
}

export async function moveLeadStage(
  leadId: string,
  status: string,
): Promise<LeadRecord> {
  const now = new Date().toISOString()

  return updateLead(leadId, {
    status,
    stage_changed_at: now,
    updated_at: now,
  })
}
