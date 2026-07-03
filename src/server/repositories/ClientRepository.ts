import 'server-only'

import { createClient } from '@/lib/supabase/server'

// Data Access Layer puro para clients (tabela existente). Regras/permissões/isolamento pertencem ao
// Service, não ao repository (ARCH-001). Só leitura nesta fundação — nada de escrita/lógica.
export type ClientRecord = Record<string, unknown> & {
  id: string
  team_id?: string | null
}

export async function getClientById(clientId: string): Promise<ClientRecord | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()
  if (error) throw error
  return data as ClientRecord | null
}

// Ledger de semanas PAGAS do cliente (tabela client_payments). Só leitura — a lógica financeira
// (payClientWeek/payDueWeeks/void) vive em lib/commission/actions.ts, intocada.
export type ClientPaymentRecord = {
  id: string
  client_id: string
  numero_semana: number
  valor_usd: number | null
  paid_on: string | null
  anulado: boolean | null
}

export async function getClientPaymentsByClient(clientId: string): Promise<ClientPaymentRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('client_payments')
    .select('id, client_id, numero_semana, valor_usd, paid_on, anulado')
    .eq('client_id', clientId)
  if (error) throw error
  return (data ?? []) as ClientPaymentRecord[]
}
