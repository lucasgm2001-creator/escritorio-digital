import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { getClientObservations } from '@/server/services/ObservationService'
import { ObservationWorkspace } from '@/components/observations/ObservationWorkspace'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

export default async function ClientObservationsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const context = await getRequestContext()
  if (!context) notFound()
  const [client, items] = await Promise.all([
    getClientWorkspace(id),
    getClientObservations(context, id),
  ])
  if (!client) notFound()

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Observações"
        subtitle={`Evolução permanente de ${client.name}. Inclui registros feitos quando ainda era lead.`}
        size="compact"
      />
      <ObservationWorkspace entityType="client" entityId={id} items={items} />
    </div>
  )
}
