import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { requireModuleEntry } from '@/server/security/module-guard'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { ClientWorkspaceShell } from '@/components/client/ClientWorkspaceShell'

// Workspace do Cliente (CLIENT-SHELL-001). A casca é LEVE (header + abas horizontais + conteúdo) e vive DENTRO
// do DashboardShell — sem 2ª casca. Escopo por equipe no ClientWorkspaceService (cliente de outra equipe → notFound).
export default async function ClientWorkspaceLayout({ params, children }: { params: { id: string }; children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  requireModuleEntry(context, 'clientes')   // "Sem acesso → nem entra" (PERMISSIONS-002)
  const client = await getClientWorkspace(params.id)
  if (!client) notFound()

  return (
    <ClientWorkspaceShell clientId={client.id} clientName={client.name} subtitle={client.company ?? null}>
      {children}
    </ClientWorkspaceShell>
  )
}
