import { KanbanBoard } from './KanbanBoard'
import { createClient } from '@/lib/supabase/server'
import { getStages } from '@/lib/funnelStages.server'
import { getRequestContext } from '@/server/context/request-context'

export default async function ComercialPage() {
  const supabase = createClient()

  const [context, stages] = await Promise.all([
    getRequestContext(),
    getStages(),
  ])

  const activeTeamId = context?.activeTeamId ?? null

  const [{ data: leads }, { data: clients }] = activeTeamId
    ? await Promise.all([
        supabase.from('leads').select('*').eq('team_id', activeTeamId).order('score', { ascending: false }),
        supabase.from('clients').select('*').eq('team_id', activeTeamId).order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      initialStages={stages}
      initialClients={clients ?? []}
      currentUser={{
        id:   context?.profile?.id   ?? context?.user.id   ?? '',
        name: context?.profile?.name ?? context?.user.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
