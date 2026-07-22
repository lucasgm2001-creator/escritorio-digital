import { HallClient } from './HallClient'
import { capitalizeName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { getDashboardData, EMPTY_DASHBOARD } from '@/server/services/DashboardService'
import type { Task, LinkOption } from '../tarefas/types'
import type { CalendarEvent } from './calendarShared'
import type { MapLead, MapClient } from '../comercial/mapTypes'

export default async function HallPage() {
  const supabase = createClient()
  const context = await getRequestContext()
  const activeTeamId = context?.activeTeamId ?? null

  // Atividades/leads/clients são dados da equipe ativa. Tarefas são PESSOAIS: user_id do logado + equipe ativa
  // (PERSONAL-WORK-001 — cada colaborador só vê as suas; novo membro entra zerado). O cockpit
  // (prioridades/KPIs/alertas) vem do DashboardService (reusa getCommercialDashboard — mesma fonte do Comercial).
  const [{ data: activities }, tasksRes, calendarRes, leadsRes, clientsRes, dashboard] = await Promise.all([
    activeTeamId
      ? supabase.from('activities').select('id, type, description, user_id, user_name, entity_id, created_at').eq('team_id', activeTeamId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('tasks').select('*').eq('user_id', context?.user.id ?? '').eq('team_id', activeTeamId).order('due_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('calendar_events').select('id, user_id, title, date, start_time, end_time, description, type, color, created_at').eq('user_id', context?.user.id ?? '').eq('team_id', activeTeamId).order('date')
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('leads').select('id, name, phone, company, nicho, status, state, area_code, created_at, origem').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('clients').select('id, name, phone, company, status, state, area_code').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
    context ? getDashboardData(context) : Promise.resolve(EMPTY_DASHBOARD),
  ])

  const linkOptions: LinkOption[] = [
    ...(leadsRes.data ?? []).map(l => ({ type: 'lead' as const, id: l.id, name: l.name, phone: l.phone, detail: l.nicho || l.company || null })),
    ...(clientsRes.data ?? []).map(c => ({ type: 'client' as const, id: c.id, name: c.name, phone: c.phone, detail: c.company || null })),
  ]

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialTasks={(tasksRes.data ?? []) as Task[]}
      initialCalendarEvents={(calendarRes.data ?? []) as CalendarEvent[]}
      initialMapLeads={(leadsRes.data ?? []) as MapLead[]}
      initialMapClients={(clientsRes.data ?? []) as MapClient[]}
      linkOptions={linkOptions}
      userName={capitalizeName(context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário')}
      userId={context?.user.id ?? ''}
      activeTeamId={activeTeamId}
      dashboard={dashboard}
    />
  )
}
