import { redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { DomainShell } from '@/components/domain/DomainShell'

export const metadata = { title: 'Tráfego · Escritório Digital' }

// Domínio Tráfego (operacional): acessível a qualquer membro da equipe (sem gate de papel).
export default async function TrafegoLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  if (context.memberships.length === 0) redirect('/onboarding')

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  return (
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
  )
}
