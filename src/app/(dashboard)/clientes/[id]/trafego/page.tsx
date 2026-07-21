import { notFound } from 'next/navigation'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { TrafficDashboard } from '@/components/traffic/TrafficDashboard'

// Tráfego do Cliente — REUSA exatamente o mesmo TrafficDashboard do módulo global, escopado ao cliente
// (clientName). Mesmo módulo, sem duplicação; a futura filtragem real por cliente entra no serviço.
export default async function ClientTrafegoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const client = await getClientWorkspace(params.id)
  if (!client) notFound()
  return <TrafficDashboard clientName={client.name} />
}
