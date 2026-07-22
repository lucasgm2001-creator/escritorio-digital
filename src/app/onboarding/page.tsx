import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/session'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from './OnboardingClient'

// Rota FORA do grupo (dashboard) — não cai na guarda de equipe (senão criaria loop). Exige login (middleware
// já protege; reforçado aqui). Se o usuário JÁ tem equipe, não precisa de onboarding → vai pro app.
export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const supabase = createClient()
  const { data: membership, error } = await supabase
    .from('team_members').select('id').eq('user_id', user.id).limit(1)
  if (!error && membership && membership.length > 0) redirect('/mesa')

  // userEmail: mostra qual conta está logada e alimenta o "Sair / trocar de conta" — a saída SEMPRE
  // disponível aqui (senão uma conta sem equipe fica presa: /login volta pro /hall → /onboarding).
  return <OnboardingClient userEmail={user.email ?? null} />
}
