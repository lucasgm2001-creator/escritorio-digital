import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ToastProvider } from '@/components/ui/toast'
import { capitalizeName } from '@/lib/utils'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { CommissionLockProvider } from '@/components/commission/CommissionLock'
import { RoleProvider } from '@/components/auth/RoleProvider'
import { ModuleAccessProvider } from '@/components/auth/ModuleAccessProvider'

const PAGE_TITLES: Record<string, string> = {
  '/mesa':           'Minha Mesa',
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/studio':         'Studio de Apresentação',
  '/tarefas':        'Tarefas',
  '/clientes':       'Clientes',
  '/configuracoes':  'Configurações',
  '/perfil':         'Meu Perfil',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth primeiro (necessária para o resto); NÃO redirecionar em erro de profile —
  // o usuário ESTÁ autenticado (getUser passou); redirecionar daqui colidiria com o
  // middleware e criaria loop (ERR_TOO_MANY_REDIRECTS). Em erro, nome cai pro e-mail.
  const context = await getRequestContext()
  if (!context) redirect('/login')

  // GUARDA DE EQUIPE (multi-tenant): sem linha em team_members (RLS já restringe à própria equipe) → manda
  // pro /onboarding (criar/entrar em equipe). Quem JÁ tem equipe segue direto, sem nunca ver o onboarding.
  if (context.memberships.length === 0) redirect('/onboarding')

  // profile (name + avatar numa query só, cacheada por request). A marca do app é o símbolo oficial
  // (componente BrandMark na Sidebar/cabeçalho) — não depende do logo do Storage.
  const avatarUrl = context.profile?.avatar_url ?? null

  // Equipes do usuário para o Workspace Switcher (Part 5) — fonte única em switcherTeamsFromContext.
  const teams = switcherTeamsFromContext(context)

  return (
    <ModuleAccessProvider access={context.moduleAccess} canManageTeam={canAccessAdmin(context)}>
      <DashboardShell
        userName={capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')}
        userId={context.user.id}
        avatarUrl={avatarUrl}
        pageTitles={PAGE_TITLES}
        activeTeamName={context.activeTeamName}
        userEmail={context.user.email ?? null}
        teams={teams}
      >
        <ToastProvider><CommissionLockProvider><RoleProvider role={context.role} activeTeamId={context.activeTeamId}>{children}</RoleProvider></CommissionLockProvider></ToastProvider>
      </DashboardShell>
    </ModuleAccessProvider>
  )
}
