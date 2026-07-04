import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getCollaboratorDetail } from '@/server/services/PeopleService'
import { CollaboratorDetail } from '@/components/people/CollaboratorDetail'

export default async function ColaboradorDetailPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const collaborator = context ? await getCollaboratorDetail(context, params.id) : null
  if (!collaborator) notFound()

  // Editor de permissões (PERMISSIONS-002): só o OWNER personaliza, e só MEMBERS (owner/admin têm acesso
  // total). O serviço revalida tudo no servidor — este flag apenas decide se a UI mostra os controles.
  const canEditPermissions = !!context && context.role === 'owner' && collaborator.teamRole === 'member'

  return <CollaboratorDetail collaborator={collaborator} teamName={context?.activeTeamName ?? null} canEditPermissions={canEditPermissions} />
}
