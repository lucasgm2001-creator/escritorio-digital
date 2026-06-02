import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { capitalizeName } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/clientes':       'Clientes',
  '/financeiro':     'Financeiro',
  '/trafego':        'Tráfego',
  '/administrativo': 'Administrativo',
  '/configuracoes':  'Configurações',
  '/perfil':         'Meu Perfil',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Caminho crítico de auth: só colunas garantidas (name, role). Falha ALTO —
  // nunca renderizamos o shell com role vazio (causa do menu só-Hall).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('[dashboard/layout] profile fetch failed:', profileError)
    redirect('/login')
  }

  // avatar_url é opcional (pode não existir antes da migration 010/011).
  // Best-effort e isolada: qualquer erro de schema vira avatar nulo, sem
  // nunca afetar o role acima.
  let avatarUrl: string | null = null
  try {
    const { data: extra } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
    avatarUrl = extra?.avatar_url ?? null
  } catch {
    avatarUrl = null
  }

  return (
    <DashboardShell
      userName={capitalizeName(profile.name ?? user.email?.split('@')[0] ?? 'Usuário')}
      userRole={profile.role}
      userId={user.id}
      avatarUrl={avatarUrl}
      pageTitles={PAGE_TITLES}
    >
      {children}
    </DashboardShell>
  )
}
