import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { MesaClient, type MesaLead } from './MesaClient'
import type { Task, LinkOption } from '../tarefas/types'

const LEAD_COLUMNS = 'id, name, company, email, phone, status, score, assigned_name, prioridade, next_contact, last_contact_at, stage_changed_at, created_at, current_situation, last_action, next_action, temperature, followup_state, situation_updated_at'

export default async function MesaPage() {
  const context = await getRequestContext()
  if (context) requireModuleEntry(context, 'hall')

  const supabase = createClient()
  const teamId = context?.activeTeamId ?? null
  const userId = context?.user.id ?? ''

  const [tasksRes, leadsRes, clientsRes] = teamId
    ? await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', userId).eq('team_id', teamId).order('due_date', { ascending: true }),
        supabase.from('leads').select(LEAD_COLUMNS).eq('team_id', teamId).neq('status', 'lixeira').order('score', { ascending: false }),
        supabase.from('clients').select('id, name, phone, company').eq('team_id', teamId).order('name'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const leads = (leadsRes.data ?? []) as MesaLead[]
  const linkOptions: LinkOption[] = [
    ...leads.map(lead => ({ type: 'lead' as const, id: lead.id, name: lead.name, phone: lead.phone, detail: lead.company })),
    ...(clientsRes.data ?? []).map(client => ({ type: 'client' as const, id: client.id, name: client.name, phone: client.phone, detail: client.company })),
  ]

  return (
    <MesaClient
      initialTasks={(tasksRes.data ?? []) as Task[]}
      initialLeads={leads}
      linkOptions={linkOptions}
      currentUser={{
        id: userId,
        name: context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
