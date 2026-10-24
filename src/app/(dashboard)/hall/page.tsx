import { HallClient } from './HallClient'
import { capitalizeName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { getDashboardData, EMPTY_DASHBOARD } from '@/server/services/DashboardService'
import type { MapLead, MapClient } from '../comercial/mapTypes'

export default async function HallPage() {
  const supabase = createClient()
  const context = await getRequestContext()
  const activeTeamId = context?.activeTeamId ?? null

  // Hall = painel da EMPRESA (HALL-EMPRESA-001): atividades, leads/clientes do mapa e os números da companhia
  // (DashboardService). Tarefas e agenda são trabalho pessoal — moram no Follow-up do Comercial.
  const [{ data: activities }, leadsRes, clientsRes, dashboard] = await Promise.all([
    activeTeamId
      ? supabase.from('activities').select('id, type, description, user_id, user_name, entity_id, created_at').eq('team_id', activeTeamId).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('leads').select('id, name, status, state, area_code, created_at, origem').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
    activeTeamId
      ? supabase.from('clients').select('id, name, status, state, area_code').eq('team_id', activeTeamId).order('name')
      : Promise.resolve({ data: [] }),
    context ? getDashboardData(context) : Promise.resolve(EMPTY_DASHBOARD),
  ])

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialMapLeads={(leadsRes.data ?? []) as MapLead[]}
      initialMapClients={(clientsRes.data ?? []) as MapClient[]}
      userName={capitalizeName(context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário')}
      userId={context?.user.id ?? ''}
      activeTeamId={activeTeamId}
      dashboard={dashboard}
    />
  )
}
