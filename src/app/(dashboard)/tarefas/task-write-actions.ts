'use server'

import { getRequestContext } from '@/server/context/request-context'
import { createClient } from '@/lib/supabase/server'

// Escritas de TAREFAS (PERMISSIONS-005). `tasks` não é um módulo da matriz — é produtividade da equipe,
// escopada por team_id (RLS team_scope) e com dono (user_id). Regra: membro autenticado da equipe gerencia
// tarefas (criar/editar/concluir/excluir). A action valida sessão + equipe ativa, carimba user_id/team_id no
// SERVIDOR (nunca vêm da UI) e filtra os campos por allowlist — bloqueia patch arbitrário e chamada indevida.
type WriteError = { message: string } | null
type Row = Record<string, unknown>

// Campos que a UI pode gravar. user_id/team_id/done/completed_at são controlados aqui, não via este allowlist.
const TASK_COLS = [
  'title', 'notes', 'due_date', 'due_time', 'priority',
  'linked_type', 'linked_id', 'linked_name', 'responsavel_id', 'responsavel_nome',
  'add_call', 'duration_min', 'timezone',
] as const
// No update também aceitamos o toggle de conclusão.
const TASK_UPDATE_COLS = [...TASK_COLS, 'done', 'completed_at'] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guard() {
  const context = await getRequestContext()
  if (!context) return { context: null, error: { message: 'Sessão expirada. Entre novamente.' } as WriteError }
  if (!context.activeTeamId) return { context: null, error: { message: 'Selecione uma equipe ativa.' } as WriteError }
  return { context, error: null as WriteError }
}

export async function createTaskAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guard()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const { data, error } = await supabase.from('tasks')
    .insert({ ...pick(input, TASK_COLS), user_id: g.context.user.id, done: false, team_id: g.context.activeTeamId })
    .select().single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function updateTaskAction(id: string, patch: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guard()
  if (!g.context) return { data: null, error: g.error }
  const clean = pick(patch, TASK_UPDATE_COLS)
  if (Object.keys(clean).length === 0) return { data: null, error: null }
  const supabase = createClient()
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca muta tarefa de outra equipe
  // (o RLS pessoal own-or-admin segue valendo por baixo). teamId garantido pelo guard().
  const teamId = g.context.activeTeamId
  let q = supabase.from('tasks').update(clean).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { data, error } = await q.select().single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function deleteTaskAction(id: string): Promise<{ error: WriteError }> {
  const g = await guard()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('tasks').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: error ? { message: error.message } : null }
}
