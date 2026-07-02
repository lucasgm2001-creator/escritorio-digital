import { HallClient } from './HallClient'
import { capitalizeName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import type { Task, LinkOption } from '../tarefas/types'

export default async function HallPage() {
  const supabase = createClient()
  const context = await getRequestContext()
  const activeTeamId = context?.activeTeamId ?? null

  // Atividades/leads/clients são dados da equipe ativa. Tarefas seguem pessoais por user_id.
  const [{ data: activities }, tasksRes, leadsRes, clientsRes] = await Promise.all([
    activeTeamId
      ? supabase.from('activities').select('*').eq('team_id', activeTeamId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    supabase.from('tasks').select('*').eq('user_id', context?.user.id ?? '').order('due_date', { ascending: true }),
    activeTeamId
      ? supabase.from('leads').select('id, name, phone, company, nicho').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('clients').select('id, name, phone, company').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
  ])

  const linkOptions: LinkOption[] = [
    ...(leadsRes.data ?? []).map(l => ({ type: 'lead' as const, id: l.id, name: l.name, phone: l.phone, detail: l.nicho || l.company || null })),
    ...(clientsRes.data ?? []).map(c => ({ type: 'client' as const, id: c.id, name: c.name, phone: c.phone, detail: c.company || null })),
  ]

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialTasks={(tasksRes.data ?? []) as Task[]}
      linkOptions={linkOptions}
      userName={capitalizeName(context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário')}
      userId={context?.user.id ?? ''}
    />
  )
}
