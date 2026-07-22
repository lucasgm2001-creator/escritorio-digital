import { KanbanBoard } from './KanbanBoard'
import { createClient } from '@/lib/supabase/server'
import { getStages } from '@/lib/funnelStages.server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'

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

  const [{ data: leads }, { data: clients }] = activeTeamId
    ? await Promise.all([
        // O payload bruto pode ser grande e só é necessário ao abrir um lead. O LeadDiary o busca sob demanda.
        supabase.from('leads').select(LEAD_LIST_COLUMNS).eq('team_id', activeTeamId).order('score', { ascending: false }),
        // Dossiê/Drive são carregados somente quando essa aba do modal é aberta.
        supabase.from('clients').select(CLIENT_LIST_COLUMNS).eq('team_id', activeTeamId).order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      initialStages={stages}
      initialClients={clients ?? []}
      currentUser={{
        id:   context?.profile?.id   ?? context?.user.id   ?? '',
        name: context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
