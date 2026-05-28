import { createClient } from '@/lib/supabase/server'
import { HallClient } from './HallClient'

export default async function HallPage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: activities },
    { data: notices },
    { count: totalLeads },
    { data: activeClients },
    { count: pendingTasks },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('plan_weekly').eq('status', 'ativo'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  const mrr = (activeClients ?? []).reduce((sum, c) => sum + (c.plan_weekly ?? 0) * 4, 0)

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialNotices={notices ?? []}
      userName={profile?.name ?? 'Usuário'}
      userRole={profile?.role ?? 'admin'}
      userId={user?.id ?? ''}
      stats={{
        totalLeads: totalLeads ?? 0,
        activeClients: (activeClients ?? []).length,
        mrr,
        pendingTasks: pendingTasks ?? 0,
      }}
    />
  )
}
