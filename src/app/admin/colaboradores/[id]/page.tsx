import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getCollaboratorDetail } from '@/server/services/PeopleService'
import { CollaboratorDetail } from '@/components/people/CollaboratorDetail'

export default async function ColaboradorDetailPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const collaborator = context ? await getCollaboratorDetail(context, params.id) : null
  if (!collaborator) notFound()

  return <CollaboratorDetail collaborator={collaborator} teamName={context?.activeTeamName ?? null} />
}
