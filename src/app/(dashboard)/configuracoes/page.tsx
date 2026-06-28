import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ConfiguracoesClient } from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Status da conexão Google do usuário (service role — a tabela tem RLS sem policies). SÓ {connected, email}
  // cruza pro client: o refresh/access token NUNCA sai do servidor.
  const admin = createServiceClient()
  const { data: tok } = await admin
    .from('google_oauth_tokens')
    .select('google_email, refresh_token, access_token')
    .eq('user_id', user.id)
    .maybeSingle()
  const google = {
    connected: !!(tok && (tok.refresh_token || tok.access_token)),
    email: (tok?.google_email as string | null) ?? null,
  }

  return (
    <ConfiguracoesClient userId={user.id} google={google} />
  )
}
