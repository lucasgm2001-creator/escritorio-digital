import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Data Access Layer puro para clients (tabela existente). Regras/permissões/isolamento pertencem ao
// Service, não ao repository (ARCH-001). Só leitura — nada de escrita/lógica.
// Leituras cacheadas por request (React cache) → Resumo, Financeiro e Timeline compartilham a MESMA
// consulta, sem duplicar (PERFORMANCE).
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

export const getClientPaymentsByClient = cache(async (clientId: string): Promise<ClientPaymentRecord[]> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('client_payments')
    .select('id, client_id, numero_semana, valor_usd, paid_on, anulado')
    .eq('client_id', clientId)
  if (error) throw error
  return (data ?? []) as ClientPaymentRecord[]
})

// Atividades do cliente (tabela activities, chaveada por entity_id genérico). Fonte OPCIONAL da timeline:
// degrada para vazio em erro (o cliente pode não ter atividades — não quebra a tela).
export type ClientActivityRecord = { id: string; type: string; description: string | null; user_name: string | null; created_at: string | null }

export const getClientActivities = cache(async (clientId: string): Promise<ClientActivityRecord[]> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, description, user_name, created_at')
    .eq('entity_id', clientId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as ClientActivityRecord[]
})
