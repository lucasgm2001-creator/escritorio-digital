import { ClientesFloor } from './ClientesFloor'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import type { Client, Nicho, ClientIntegration } from './types'

// Andar "Clientes" — vida do cliente DEPOIS da venda (Hub + Integrações). Dados via SSR (client/cookies),
// então re-hidrata fresco a cada navegação; o realtime mantém ao vivo no client.
export default async function ClientesPage() {
  const supabase = createClient()
  const [context, { data: nichos }, { data: integrations }] = await Promise.all([
    getRequestContext(),
    // Projeção explícita (PERF-007): só as colunas lidas na tela. Omite created_at (nunca usado). Sem realtime/spread.
    supabase.from('nichos').select('id, nome, cor, posicao, ativo').order('posicao'),
    // Projeção explícita (PERF-007): só as colunas lidas. Omite team_id (nunca lido no client; RLS filtra no servidor). Sem realtime/spread.
    supabase.from('client_integrations').select('id, client_id, ativo, instancia, numero_destino, template, landing_pages, created_at, updated_at'),
  ])

  const activeTeamId = context?.activeTeamId ?? null

  // clients mantém select('*'): estado realtime funde a linha COMPLETA e há spreads {...client} (dossie/drive)
  // → projetar criaria mismatch de colunas. (PERF futuro: exigiria projetar o realtime também.)
  const { data: clients } = activeTeamId
    ? await supabase.from('clients').select('*').eq('team_id', activeTeamId).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <ClientesFloor
      initialClients={(clients ?? []) as Client[]}
      initialNichos={(nichos ?? []) as Nicho[]}
      initialIntegrations={(integrations ?? []) as ClientIntegration[]}
    />
  )
}
