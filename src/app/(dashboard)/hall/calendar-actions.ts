'use server'

import { createClient } from '@/lib/supabase/server'
import { pickAllowed, requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'

// Escritas da AGENDA do Hall (calendar_events — PERMISSIONS-004). Criar/excluir evento passa pelo servidor:
// can(calendar,'create'|'delete'). team_id e user_id carimbados no servidor (nunca vêm da UI). Allowlist.
type WriteError = ActionError
type Row = Record<string, unknown>

const EVENT_COLS = ['title', 'date', 'start_time', 'end_time', 'description', 'type', 'color'] as const

export async function createCalendarEventAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const g = await requireActionContext({
    permission: { module: 'calendar', action: 'create' },
    deniedMessage: 'Você não tem permissão para criar eventos.',
  })
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('calendar_events')
    .insert({ ...pickAllowed(input, EVENT_COLS), user_id: g.context.user.id, ...(teamId ? { team_id: teamId } : {}) })
    .select().single()
  return { data: (data as Row) ?? null, error: toActionError(error) }
}

export async function deleteCalendarEventAction(id: string): Promise<{ error: WriteError }> {
  const g = await requireActionContext({
    permission: { module: 'calendar', action: 'delete' },
    deniedMessage: 'Você não tem permissão para excluir eventos.',
  })
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca exclui evento de outra equipe.
  const teamId = g.context.activeTeamId
  let q = supabase.from('calendar_events').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}
