import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import type { FunnelStage } from './funnelStages'

// Fonte única (server, deduplicada por request via React cache) das fases do funil.
// Server Components (ex.: ComercialPage) e o agente leem daqui.
// Filtra pela EQUIPE ATIVA: a RLS (team_scope) devolve as fases de TODAS as equipes do usuário, então quem
// participa de duas via colunas duplicadas no funil e fases misturadas no relatório. Sem contexto (não
// deveria acontecer — todos os chamadores têm sessão), cai no comportamento antigo: só a RLS.
export const getStages = cache(async (): Promise<FunnelStage[]> => {
  const supabase = createClient()
  const context = await getRequestContext()
  let query = supabase.from('funnel_stages').select('*').order('posicao')
  if (context?.activeTeamId) query = query.eq('team_id', context.activeTeamId)
  const { data } = await query
  return (data ?? []) as FunnelStage[]
})
