'use server'

import { getRequestContext } from '@/server/context/request-context'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarEvent } from '@/app/(dashboard)/hall/calendarShared'

// Agenda administrativa (ACCESS-ROLES-001, Parte 6): OWNER/DESENVOLVEDOR VÊ a agenda de um colaborador.
// REUSA calendar_events (mesma tabela e shape do Hall) — nenhum calendário novo, nenhuma tabela nova. Só
// LEITURA. Service-role só APÓS canAccessAdmin + ownership (o alvo é membro da equipe ativa; RLS pessoal
// impediria a leitura de outro user, por isso o service-role gated). Não escreve nada.
type Res = { ok: true; events: CalendarEvent[] } | { ok: false; error: string }

export async function getCollaboratorAgendaAction(userId: string): Promise<Res> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada.' }
  if (!canAccessAdmin(context)) return { ok: false, error: 'Apenas Owner ou Desenvolvedor podem ver agendas.' }
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, error: 'Sem equipe ativa.' }

  const svc = createServiceClient()
  const { data: member } = await svc.from('team_members').select('id').eq('team_id', teamId).eq('user_id', userId).maybeSingle()
  if (!member) return { ok: false, error: 'Colaborador não pertence à sua equipe.' }

  const { data, error } = await svc.from('calendar_events').select('*').eq('user_id', userId).order('date', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, events: (data ?? []) as CalendarEvent[] }
}
