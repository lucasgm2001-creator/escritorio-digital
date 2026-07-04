'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escritas da AGENDA do Hall (calendar_events — PERMISSIONS-004). Criar/excluir evento passa pelo servidor:
// can(calendar,'create'|'delete'). team_id e user_id carimbados no servidor (nunca vêm da UI). Allowlist.
type WriteError = { message: string } | null
type Row = Record<string, unknown>

const EVENT_COLS = ['title', 'date', 'start_time', 'end_time', 'description', 'type', 'color'] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

export async function createCalendarEventAction(input: Record<string, unknown>): Promise<{ data: Row | null; error: WriteError }> {
  const context = await getRequestContext()
  if (!context) return { data: null, error: { message: 'Sessão expirada. Entre novamente.' } }
  if (!can(context, 'calendar', 'create')) return { data: null, error: { message: 'Você não tem permissão para criar eventos.' } }
  const supabase = createClient()
  const teamId = context.activeTeamId
  const { data, error } = await supabase.from('calendar_events')
    .insert({ ...pick(input, EVENT_COLS), user_id: context.user.id, ...(teamId ? { team_id: teamId } : {}) })
    .select().single()
  return { data: (data as Row) ?? null, error: error ? { message: error.message } : null }
}

export async function deleteCalendarEventAction(id: string): Promise<{ error: WriteError }> {
  const context = await getRequestContext()
  if (!context) return { error: { message: 'Sessão expirada. Entre novamente.' } }
  if (!can(context, 'calendar', 'delete')) return { error: { message: 'Você não tem permissão para excluir eventos.' } }
  const supabase = createClient()
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}
