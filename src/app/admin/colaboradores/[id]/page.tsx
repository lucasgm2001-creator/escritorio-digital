import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { getCollaboratorDetail } from '@/server/services/PeopleService'
import { CollaboratorDetail } from '@/components/people/CollaboratorDetail'

export default async function ColaboradorDetailPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const collaborator = context ? await getCollaboratorDetail(context, params.id) : null
  if (!collaborator) notFound()

  // Editor de permissões (PERMISSIONS-002): só o OWNER personaliza, e só MEMBERS (owner/admin têm acesso
  // total). O serviço revalida tudo no servidor — este flag apenas decide se a UI mostra os controles.
  const canEditPermissions = !!context && context.role === 'owner' && collaborator.teamRole === 'member'
  // Alterar cargo/departamento: owner/admin (mesma guarda do servidor na action). PEOPLE-002A.
  const canManageRole = !!context && can(context, 'teams', 'manage')

  return <CollaboratorDetail collaborator={collaborator} teamName={context?.activeTeamName ?? null} canEditPermissions={canEditPermissions} canManageRole={canManageRole} />
}
