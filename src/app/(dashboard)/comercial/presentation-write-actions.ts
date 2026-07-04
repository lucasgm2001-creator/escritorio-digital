'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escritas do Studio de Apresentação (dentro do Comercial — PERMISSIONS-004). Editar materiais/apresentações
// = commercial.edit. O UPLOAD/REMOÇÃO no storage segue client-side (RLS de storage); aqui só as LINHAS das
// tabelas presentation_materials/presentations. Allowlist + team_id no servidor; nunca confia na UI.
type WriteError = { message: string } | null
type Row = Record<string, unknown>

const DENY: WriteError = { message: 'Você não tem permissão para editar no Comercial.' }
const EXPIRED: WriteError = { message: 'Sessão expirada. Entre novamente.' }

const MATERIAL_CREATE_COLS = ['name', 'storage_path', 'url', 'mime_type', 'size_bytes', 'pasta', 'nicho'] as const
const MATERIAL_UPDATE_COLS = ['pasta', 'nicho', 'favorito'] as const
const PRESENTATION_COLS = ['name', 'lead_id', 'items'] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guardEdit() {
  const context = await getRequestContext()
  if (!context) return { context: null, error: EXPIRED } as const
  if (!can(context, 'commercial', 'edit')) return { context: null, error: DENY } as const
  return { context, error: null } as const
}

// ── presentation_materials ───────────────────────────────────────────────────────────────────────────
export async function createMaterialAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('presentation_materials')
    .insert({ ...pick(input, MATERIAL_CREATE_COLS), ...(teamId ? { team_id: teamId } : {}) })
    .select('*').single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function updateMaterialAction(id: string, patch: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const clean = pick(patch, MATERIAL_UPDATE_COLS)
  if (Object.keys(clean).length === 0) return { error: null }
  const supabase = createClient()
  const { error } = await supabase.from('presentation_materials').update(clean).eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export async function deleteMaterialAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('presentation_materials').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}

// ── presentations ────────────────────────────────────────────────────────────────────────────────────
export async function createPresentationAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('presentations')
    .insert({ ...pick(input, PRESENTATION_COLS), ...(teamId ? { team_id: teamId } : {}) })
    .select('*').single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function updatePresentationAction(id: string, patch: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const { data, error } = await supabase.from('presentations')
    .update({ ...pick(patch, PRESENTATION_COLS), updated_at: new Date().toISOString() }).eq('id', id)
    .select('*').single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function deletePresentationAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardEdit()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('presentations').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}
