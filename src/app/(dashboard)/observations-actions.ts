'use server'

import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import type { ObservationEntityType } from '@/lib/observations/types'

type Result = { ok: true } | { ok: false; error: string }

async function canEditEntity(entityType: ObservationEntityType, entityId: string) {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return null
  const permissionModule = entityType === 'lead' ? 'commercial' : 'clients'
  if (!can(context, permissionModule, 'edit')) return null
  const table = entityType === 'lead' ? 'leads' : 'clients'
  const supabase = createClient()
  const { data } = await supabase.from(table).select('id').eq('id', entityId).eq('team_id', context.activeTeamId).maybeSingle()
  return data ? { context, supabase } : null
}

export async function addEntityObservationAction(entityType: ObservationEntityType, entityId: string, body: string): Promise<Result> {
  const clean = body.trim()
  if (!clean) return { ok: false, error: 'Escreva a observação.' }
  if (clean.length > 10_000) return { ok: false, error: 'A observação ultrapassa o limite de 10.000 caracteres.' }
  const auth = await canEditEntity(entityType, entityId)
  if (!auth) return { ok: false, error: 'Você não tem permissão para editar este registro.' }
  const { context, supabase } = auth
  // No lead, mantém também a Timeline/estatísticas existentes; o gatilho transforma a interação
  // na observação permanente. No cliente, a observação nasce diretamente no histórico próprio.
  const { error } = entityType === 'lead'
    ? await supabase.from('lead_interactions').insert({
      team_id: context.activeTeamId,
      lead_id: entityId,
      type: 'nota',
      note: clean,
      score_delta: 0,
      created_by: context.user.id,
      created_by_name: context.profile?.name ?? null,
    })
    : await supabase.from('entity_observations').insert({
      team_id: context.activeTeamId,
      entity_type: entityType,
      entity_id: entityId,
      body: clean,
      source_type: 'manual',
      source_label: 'Observação manual',
      created_by: context.user.id,
      created_by_name: context.profile?.name ?? null,
    })
  return error ? { ok: false, error: 'Não foi possível salvar a observação.' } : { ok: true }
}

export async function updateEntityObservationAction(observationId: string, body: string): Promise<Result> {
  const clean = body.trim()
  if (!clean) return { ok: false, error: 'A observação não pode ficar vazia.' }
  if (clean.length > 10_000) return { ok: false, error: 'A observação ultrapassa o limite de 10.000 caracteres.' }
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, error: 'Sessão expirada.' }
  const supabase = createClient()
  const { data: row } = await supabase.from('entity_observations')
    .select('id, entity_type, entity_id, source_type, source_id')
    .eq('id', observationId)
    .eq('team_id', context.activeTeamId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Observação não encontrada.' }
  const auth = await canEditEntity(row.entity_type as ObservationEntityType, row.entity_id)
  if (!auth) return { ok: false, error: 'Você não tem permissão para editar esta observação.' }
  const { error } = await supabase.from('entity_observations').update({
    body: clean,
    updated_at: new Date().toISOString(),
    edited_at: new Date().toISOString(),
  }).eq('id', observationId).eq('team_id', context.activeTeamId)
  if (error) return { ok: false, error: 'Não foi possível editar a observação.' }
  if (row.source_type === 'lead_interaction' && row.source_id) {
    await supabase.from('lead_interactions').update({ note: clean })
      .eq('id', row.source_id).eq('team_id', context.activeTeamId)
  }
  return { ok: true }
}
