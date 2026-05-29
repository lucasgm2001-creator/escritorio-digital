import { createClient } from '@/lib/supabase/server'
import { AdminClient } from './AdminClient'

export default async function AdministrativoPage() {
  const supabase = createClient()

  const [
    { data: profiles },
    { count: totalLeads },
    { count: totalClients },
    { count: totalSellers },
    { data: recentActivities },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, role, email, created_at').order('name'),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('sellers').select('*', { count: 'exact', head: true }),
    supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(30),
  ])

  return (
    <AdminClient
      profiles={profiles ?? []}
      stats={{ totalLeads: totalLeads ?? 0, totalClients: totalClients ?? 0, totalSellers: totalSellers ?? 0 }}
      recentActivities={recentActivities ?? []}
    />
  )
}
