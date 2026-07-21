import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { getCollaboratorDetail } from '@/server/services/PeopleService'
import { CollaboratorDetail } from '@/components/people/CollaboratorDetail'

export default async function ColaboradorDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const collaborator = context ? await getCollaboratorDetail(context, params.id) : null
  if (!collaborator) notFound()

  // Editor de permissões (PERMISSIONS-002): só o OWNER personaliza, e só MEMBERS (owner/admin têm acesso
  // total). O serviço revalida tudo no servidor — este flag apenas decide se a UI mostra os controles.
  const canEditPermissions = !!context && context.role === 'owner' && collaborator.teamRole === 'member'
  // Alterar cargos: OWNER ou DESENVOLVEDOR (canAccessAdmin) — mesma guarda do servidor na action (ACCESS-ROLES-001).
  const canManageRole = !!context && canAccessAdmin(context)

  return <CollaboratorDetail collaborator={collaborator} teamName={context?.activeTeamName ?? null} canEditPermissions={canEditPermissions} canManageRole={canManageRole} />
}
