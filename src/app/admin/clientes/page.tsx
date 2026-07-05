import { ClientesFloor } from '@/app/(dashboard)/clientes/ClientesFloor'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { getClientsFinanceSummary } from '@/server/services/ClientsFinanceSummaryService'
import type { Client, Nicho, ClientIntegration } from '@/app/(dashboard)/clientes/types'

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

  // clients mantém select('*'): o realtime funde a linha COMPLETA e há spreads {...client} (dossie/drive).
  const { data: clients } = activeTeamId
    ? await supabase.from('clients').select('*').eq('team_id', activeTeamId).order('created_at', { ascending: false })
    : { data: [] }

  // Resumo financeiro por cliente (Parte 5) — total recebido, próxima cobrança, pendências — na própria lista.
  const finance = context ? await getClientsFinanceSummary(context) : {}

  return (
    <ClientesFloor
      initialClients={(clients ?? []) as Client[]}
      initialNichos={(nichos ?? []) as Nicho[]}
      initialIntegrations={(integrations ?? []) as ClientIntegration[]}
      finance={finance}
    />
  )
}
