import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { getClientFinance } from '@/server/services/ClientFinanceService'
import { getClientTimeline } from '@/server/services/ClientTimelineService'
import { getClientLeadHub } from '@/server/services/ClientContextService'
import { clientHealthBand } from '@/lib/client/health-band'
import { ClientResumo } from '@/components/client/ClientResumo'

// Resumo = home do Workspace do Cliente. Combina identidade + Financeiro + última atividade/reunião +
// jornada comercial + Saúde. Todas as leituras são cacheadas por request (getClientWorkspace /
// getClientPaymentsByClient / getClientLeadHub) — sem consulta duplicada entre Resumo/Financeiro/Timeline.
const DAY = 86_400_000

export default async function ClientResumoPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  if (!context) notFound()

  const [client, finance, timeline, leadHub] = await Promise.all([
    getClientWorkspace(params.id),
    getClientFinance(context, params.id),
    getClientTimeline(context, params.id),
    getClientLeadHub(context, params.id),
  ])
  if (!client || !finance) notFound()

  const lastActivityAt = timeline[0]?.at ?? null
  const daysSinceActivity = lastActivityAt ? Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / DAY) : null
  const lastMeetingAt = leadHub?.health.lastMeetingAt ?? null
  const daysSinceLastMeeting = lastMeetingAt ? Math.floor((Date.now() - new Date(lastMeetingAt).getTime()) / DAY) : null
  const lastPaymentAt = finance.payments
    .filter(p => !p.anulado && p.paidOn)
    .map(p => p.paidOn as string)
    .sort()
    .at(-1) ?? null
  const health = clientHealthBand({ status: client.status, semanasPendentes: finance.semanasPendentes, daysSinceActivity, daysSinceLastMeeting })

  return (
    <ClientResumo
      client={client}
      finance={finance}
      lastActivityAt={lastActivityAt}
      lastMeetingAt={lastMeetingAt}
      lastPaymentAt={lastPaymentAt}
      health={health}
      journey={leadHub?.journey ?? []}
    />
  )
}
