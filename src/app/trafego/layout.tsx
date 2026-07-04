import { redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { can } from '@/lib/permissions/can'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { DomainShell } from '@/components/domain/DomainShell'
import { ModuleAccessProvider } from '@/components/auth/ModuleAccessProvider'

export const metadata = { title: 'Tráfego · Escritório Digital' }

// Domínio Tráfego (operacional): acessível a qualquer membro da equipe (sem gate de papel).
export default async function TrafegoLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  if (context.memberships.length === 0) redirect('/onboarding')
  requireModuleEntry(context, 'trafego')   // "Sem acesso → nem entra" (PERMISSIONS-002)

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  return (
    <ModuleAccessProvider access={context.moduleAccess} canManageTeam={can(context, 'teams', 'manage')}>
      <DomainShell
        configKey="traffic"
        subtitle={context.activeTeamName}
        userName={userName}
        role={context.role}
        userEmail={context.user.email ?? null}
        avatarUrl={context.profile?.avatar_url ?? null}
        teams={teams}
      >
        {children}
      </DomainShell>
    </ModuleAccessProvider>
  )
}
