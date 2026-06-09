import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilClient } from './PerfilClient'

export default async function PerfilPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, phone, cargo')
    .eq('id', user.id)
    .single()

  return (
    <PerfilClient
      userId={user.id}
      email={user.email ?? ''}
      initialName={profile?.name ?? ''}
      initialPhone={profile?.phone ?? ''}
      initialCargo={profile?.cargo ?? ''}
      initialAvatarUrl={profile?.avatar_url ?? null}
    />
  )
}
