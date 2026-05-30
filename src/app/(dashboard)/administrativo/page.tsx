import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminClient } from './AdminClient'

export default async function AdministrativoPage() {
  const supabase = createClient()

  // Verificar autenticação e autorização
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/hall')
  }

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
      userRole={profile?.role}
    />
  )
}
