import { notFound, redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { ClientWorkspaceShell } from '@/components/client/ClientWorkspaceShell'

// Workspace do Cliente (CLIENT-001). Casca com master-detail por seção (rail no desktop/iPad, bottom sheet
// no mobile). Escopo por equipe no ClientWorkspaceService (cliente de outra equipe → notFound).
export default async function ClientWorkspaceLayout({ params, children }: { params: { id: string }; children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  requireModuleEntry(context, 'clientes')   // "Sem acesso → nem entra" (PERMISSIONS-002)
  const client = await getClientWorkspace(params.id)
  if (!client) notFound()

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  return (
    <ClientWorkspaceShell
      clientId={client.id}
      clientName={client.name}
      subtitle={client.company ?? null}
      userName={userName}
      role={context.role}
      userEmail={context.user.email ?? null}
      avatarUrl={context.profile?.avatar_url ?? null}
      teams={teams}
    >
      {children}
    </ClientWorkspaceShell>
  )
}
