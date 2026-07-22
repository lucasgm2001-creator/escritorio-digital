import { ClientesFloor } from '@/app/(dashboard)/clientes/ClientesFloor'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { getClientsFinanceSummary } from '@/server/services/ClientsFinanceSummaryService'
import type { Client, Nicho, ClientIntegration } from '@/app/(dashboard)/clientes/types'

const CLIENT_LIST_COLUMNS = 'id, name, company, email, phone, plan_weekly, plano_id, dia_pagamento_semana, periodicidade, forma_pagamento, status, start_date, billing_anchor_date, end_date, assigned_name, nicho, fuso, city, state, area_code, jobs, created_at'

// Administração › Clientes (CLIENT-HISTORY-ADMIN-003): a lista de clientes vive AQUI agora — deixou de ser andar
// principal. REUSA o MESMO ClientesFloor do domínio (sem duplicar tela) e a MESMA projeção de dados da rota
// antiga. Gate = requireModuleEntry('clientes') (NÃO o owner/dev do /admin): quem tem o módulo entra; o
// /admin/layout já admitiu a entrada e filtrou a nav para mostrar só Clientes ao membro operacional.
export default async function AdminClientesPage() {
  const supabase = createClient()
  const [context, { data: nichos }, { data: integrations }] = await Promise.all([
    getRequestContext(),
    supabase.from('nichos').select('id, nome, cor, posicao, ativo').order('posicao'),
    supabase.from('client_integrations').select('id, client_id, ativo, instancia, numero_destino, template, landing_pages, created_at, updated_at'),
  ])

  // Autoridade de acesso (PERMISSIONS-002): "Sem acesso → nem entra".
  if (context) requireModuleEntry(context, 'clientes')

  const activeTeamId = context?.activeTeamId ?? null

  // Drive e dossiê podem ser grandes e são usados somente no detalhe; ClienteDetalhe os busca sob demanda.
  const [clientsRes, finance] = await Promise.all([
    activeTeamId
      ? supabase.from('clients').select(CLIENT_LIST_COLUMNS).eq('team_id', activeTeamId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    context ? getClientsFinanceSummary(context) : Promise.resolve({}),
  ])
  const clients = clientsRes.data

  return (
    <ClientesFloor
      initialClients={(clients ?? []) as Client[]}
      initialNichos={(nichos ?? []) as Nicho[]}
      initialIntegrations={(integrations ?? []) as ClientIntegration[]}
      finance={finance}
    />
  )
}
