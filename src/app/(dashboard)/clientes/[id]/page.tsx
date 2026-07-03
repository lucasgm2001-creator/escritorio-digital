import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { getClientFinance } from '@/server/services/ClientFinanceService'
import { getClientTimeline } from '@/server/services/ClientTimelineService'
import { clientHealthBand } from '@/lib/client/health-band'
import { ClientResumo } from '@/components/client/ClientResumo'

// Resumo = home do Workspace do Cliente. Combina identidade + Financeiro + última atividade + Saúde.
// Todas as leituras são cacheadas por request (getClientWorkspace / getClientPaymentsByClient) — sem
// consulta duplicada entre Resumo, Financeiro e Timeline (PERFORMANCE).
const DAY = 86_400_000

export default async function ClientResumoPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  if (!context) notFound()

  const [client, finance, timeline] = await Promise.all([
    getClientWorkspace(params.id),
    getClientFinance(context, params.id),
    getClientTimeline(context, params.id),
  ])
  if (!client || !finance) notFound()

  const lastActivityAt = timeline[0]?.at ?? null
  const daysSinceActivity = lastActivityAt ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / DAY) : null
  const health = clientHealthBand({ status: client.status, semanasPendentes: finance.semanasPendentes, daysSinceActivity })

  return <ClientResumo client={client} finance={finance} lastActivityAt={lastActivityAt} health={health} />
}
