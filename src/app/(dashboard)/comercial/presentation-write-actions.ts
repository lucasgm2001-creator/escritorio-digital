'use server'

import { createClient } from '@/lib/supabase/server'
import { pickAllowed, requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'

// Escritas do Studio de Apresentação (dentro do Comercial — PERMISSIONS-004). Editar materiais/apresentações
// = commercial.edit. O UPLOAD/REMOÇÃO no storage segue client-side (RLS de storage); aqui só as LINHAS das
// tabelas presentation_materials/presentations. Allowlist + team_id no servidor; nunca confia na UI.
type WriteError = ActionError
type Row = Record<string, unknown>

const DENY = 'Você não tem permissão para editar no Comercial.'

const MATERIAL_CREATE_COLS = ['name', 'storage_path', 'url', 'mime_type', 'size_bytes', 'pasta', 'nicho'] as const
const MATERIAL_UPDATE_COLS = ['pasta', 'nicho', 'favorito'] as const
const PRESENTATION_COLS = ['name', 'lead_id', 'items'] as const

async function guardEdit() {
  return requireActionContext({
    permission: { module: 'commercial', action: 'edit' },
    deniedMessage: DENY,
  })
}

// ── presentation_materials ───────────────────────────────────────────────────────────────────────────
export async function createMaterialAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('presentation_materials')
    .insert({ ...pickAllowed(input, MATERIAL_CREATE_COLS), ...(teamId ? { team_id: teamId } : {}) })
    .select('*').single()
  return { data: (data as Row) ?? null, error: toActionError(error) }
}

export async function updateMaterialAction(id: string, patch: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const clean = pickAllowed(patch, MATERIAL_UPDATE_COLS)
  if (Object.keys(clean).length === 0) return { error: null }
  const supabase = createClient()
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca muta material de outra equipe.
  const teamId = g.context.activeTeamId
  let q = supabase.from('presentation_materials').update(clean).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function deleteMaterialAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('presentation_materials').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

// ── presentations ────────────────────────────────────────────────────────────────────────────────────
export async function createPresentationAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('presentations')
    .insert({ ...pickAllowed(input, PRESENTATION_COLS), ...(teamId ? { team_id: teamId } : {}) })
    .select('*').single()
  return { data: (data as Row) ?? null, error: toActionError(error) }
}

export async function updatePresentationAction(id: string, patch: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('presentations')
    .update({ ...pickAllowed(patch, PRESENTATION_COLS), updated_at: new Date().toISOString() }).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { data, error } = await q.select('*').single()
  return { data: (data as Row) ?? null, error: toActionError(error) }
}

export async function deletePresentationAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('presentations').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}
