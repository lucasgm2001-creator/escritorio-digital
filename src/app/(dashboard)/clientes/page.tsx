import { ClientesFloor } from './ClientesFloor'
import { createClient } from '@/lib/supabase/server'
import type { Client, Nicho, ClientIntegration } from './types'

// Andar "Clientes" — vida do cliente DEPOIS da venda (Hub + Integrações). Dados via SSR (client/cookies),
// então re-hidrata fresco a cada navegação; o realtime mantém ao vivo no client.
export default async function ClientesPage() {
  const supabase = createClient()
  const [{ data: clients }, { data: nichos }, { data: integrations }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('nichos').select('*').order('posicao'),
    supabase.from('client_integrations').select('*'),
  ])
  return (
    <ClientesFloor
      initialClients={(clients ?? []) as Client[]}
      initialNichos={(nichos ?? []) as Nicho[]}
      initialIntegrations={(integrations ?? []) as ClientIntegration[]}
    />
  )
}
