import { KanbanBoard } from './KanbanBoard'
import { createClient } from '@/lib/supabase/server'
import { getStages } from '@/lib/funnelStages.server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import type { MesaLead, FunnelStage as MesaStage } from './followup/MesaClient'
import type { Task, LinkOption } from '../tarefas/types'

const LEAD_LIST_COLUMNS = 'id, name, company, email, phone, value, status, score, operation, assigned_to, assigned_name, notes, nicho, origem, prioridade, next_contact, last_contact_at, stage_changed_at, updated_at, created_at, received_at, incluir_no_relatorio, fuso, city, state, area_code, created_manually, contact_code, current_situation, last_action, next_action, temperature, followup_state, situation_updated_at'
const CLIENT_LIST_COLUMNS = 'id, name, company, email, phone, plan_weekly, plano_id, dia_pagamento_semana, periodicidade, forma_pagamento, status, start_date, billing_anchor_date, end_date, assigned_name, nicho, fuso, city, state, area_code, created_at'

export default async function ComercialPage() {
  const supabase = createClient()

  const [context, stages] = await Promise.all([
    getRequestContext(),
    getStages(),
  ])

  // Autoridade de acesso (PERMISSIONS-002): "Sem acesso → nem entra". Nível efetivo resolvido no servidor.
  if (context) requireModuleEntry(context, 'comercial')

  const activeTeamId = context?.activeTeamId ?? null
  const userId = context?.user.id ?? ''

  const [{ data: leads }, { data: clients }, { data: tasks }, { data: mesaStages }] = activeTeamId
    ? await Promise.all([
        // O payload bruto pode ser grande e só é necessário ao abrir um lead. O LeadDiary o busca sob demanda.
        supabase.from('leads').select(LEAD_LIST_COLUMNS).eq('team_id', activeTeamId).order('score', { ascending: false }),
        // Dossiê/Drive são carregados somente quando essa aba do modal é aberta.
        supabase.from('clients').select(CLIENT_LIST_COLUMNS).eq('team_id', activeTeamId).order('created_at', { ascending: false }),
        // Aba Follow-up (antiga Minha Mesa) — mesmas leituras que a /mesa fazia.
        supabase.from('tasks').select('*').eq('user_id', userId).eq('team_id', activeTeamId).order('due_date', { ascending: true }),
        // FASES DO FUNIL (MESA-FUNIL-001): só as não arquivadas da equipe, na ordem do funil.
        supabase.from('funnel_stages').select('slug, nome, posicao, cor, grupo')
          .eq('team_id', activeTeamId).eq('arquivada', false).order('posicao'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  // Derivados no servidor → referências estáveis entre renders do cliente (o Follow-up re-sincroniza
  // quando a prop muda, então não pode receber um array novo a cada render).
  const mesaLeads = ((leads ?? []) as MesaLead[]).filter(lead => lead.status !== 'lixeira')
  const linkOptions: LinkOption[] = [
    ...mesaLeads.map(lead => ({ type: 'lead' as const, id: lead.id, name: lead.name, phone: lead.phone, detail: lead.company })),
    ...(clients ?? []).map(client => ({ type: 'client' as const, id: client.id, name: client.name, phone: client.phone, detail: client.company })),
  ]

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      initialStages={stages}
      initialClients={clients ?? []}
      followUp={{
        initialTasks: (tasks ?? []) as Task[],
        initialLeads: mesaLeads,
        stages: (mesaStages ?? []) as MesaStage[],
        linkOptions,
      }}
      currentUser={{
        id:   context?.profile?.id   ?? context?.user.id   ?? '',
        name: context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
