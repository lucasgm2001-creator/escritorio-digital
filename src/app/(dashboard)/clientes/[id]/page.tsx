import { notFound } from 'next/navigation'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { ClientResumo } from '@/components/client/ClientResumo'

// Resumo = home do Workspace do Cliente. Mesma leitura (cacheada) do layout — sem consulta duplicada.
export default async function ClientResumoPage({ params }: { params: { id: string } }) {
  const client = await getClientWorkspace(params.id)
  if (!client) notFound()
  return <ClientResumo client={client} />
}
