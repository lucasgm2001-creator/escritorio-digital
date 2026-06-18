import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { FunnelStage } from './funnelStages'

// Fonte única (server, deduplicada por request via React cache) das fases do funil.
// Server Components (ex.: ComercialPage) e o agente leem daqui.
export const getStages = cache(async (): Promise<FunnelStage[]> => {
  const supabase = createClient()
  const { data } = await supabase.from('funnel_stages').select('*').order('posicao')
  return (data ?? []) as FunnelStage[]
})
