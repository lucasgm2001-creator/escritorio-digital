import { redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { can } from '@/lib/permissions/can'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata = { title: 'Administração · Escritório Digital' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  if (context.memberships.length === 0) redirect('/onboarding')
  // Administração é área de owner/admin. Guarda no servidor (não só na UI); a proteção
  // definitiva do DADO virá por RLS numa etapa futura (Constituição, Título 4/8).
  if (!can(context, 'teams', 'manage')) redirect('/hall')

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  return (
    <AdminShell
      activeTeamName={context.activeTeamName}
      userName={userName}
      role={context.role}
      userEmail={context.user.email ?? null}
      avatarUrl={context.profile?.avatar_url ?? null}
      teams={teams}
    >
      {children}
    </AdminShell>
  )
}
