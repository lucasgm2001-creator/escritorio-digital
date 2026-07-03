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
