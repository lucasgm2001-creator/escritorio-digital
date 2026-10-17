import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { MesaClient, type MesaLead, type FunnelStage } from './MesaClient'
import type { Task, LinkOption } from '../tarefas/types'

const LEAD_COLUMNS = 'id, name, company, email, phone, status, score, assigned_name, prioridade, next_contact, last_contact_at, stage_changed_at, created_at, received_at, current_situation, last_action, next_action, temperature, followup_state, situation_updated_at'

export default async function MesaPage() {
  const context = await getRequestContext()
  if (context) requireModuleEntry(context, 'hall')

  const supabase = createClient()
  const teamId = context?.activeTeamId ?? null
  const userId = context?.user.id ?? ''

  const [tasksRes, leadsRes, clientsRes, focusRes, stagesRes] = teamId
    ? await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', userId).eq('team_id', teamId).order('due_date', { ascending: true }),
        supabase.from('leads').select(LEAD_COLUMNS).eq('team_id', teamId).neq('status', 'lixeira').order('score', { ascending: false }),
        supabase.from('clients').select('id, name, phone, company').eq('team_id', teamId).order('name'),
        // Radar pessoal (MESA-FOCO-001). RLS já restringe a auth.uid(); o filtro explícito é defesa em
        // profundidade e deixa a intenção legível aqui.
        supabase.from('lead_focus').select('lead_id').eq('user_id', userId).eq('team_id', teamId),
        // FASES DO FUNIL (MESA-FUNIL-001). A Mesa agrupa os leads pela MESMA tabela que desenha o funil do
        // Comercial — ordem, nome e cor saem daqui. Antes a ordem era uma lista fixa no código, que já
        // ignorava três fases criadas depois (Sem dados, Não Respondeu, Achou Caro).
        supabase.from('funnel_stages').select('slug, nome, posicao, cor, grupo')
          .eq('team_id', teamId).eq('arquivada', false).order('posicao'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const leads = (leadsRes.data ?? []) as MesaLead[]
  const linkOptions: LinkOption[] = [
    ...leads.map(lead => ({ type: 'lead' as const, id: lead.id, name: lead.name, phone: lead.phone, detail: lead.company })),
    ...(clientsRes.data ?? []).map(client => ({ type: 'client' as const, id: client.id, name: client.name, phone: client.phone, detail: client.company })),
  ]

  return (
    <MesaClient
      initialTasks={(tasksRes.data ?? []) as Task[]}
      initialLeads={leads}
      initialFocus={((focusRes.data ?? []) as { lead_id: string }[]).map(row => row.lead_id)}
      stages={(stagesRes.data ?? []) as FunnelStage[]}
      linkOptions={linkOptions}
      currentUser={{
        id: userId,
        name: context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
