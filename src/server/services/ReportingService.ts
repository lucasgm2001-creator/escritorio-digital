import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialReport, ReportPeriod } from '@/core/reporting/types'
import { getRawReportData } from '@/server/repositories/ReportingRepository'

// ÚNICO lugar que calcula indicadores de relatório (Constituição: nunca calcular dentro do PDF).
// STUB de fundação: estrutura pronta, valores zerados. O PDF passará a consumir buildCommercialReport().
export async function buildCommercialReport(context: RequestContext, period: ReportPeriod): Promise<CommercialReport> {
  const empty: CommercialReport = {
    period,
    kpis: {
      totalLeads: 0, newLeads: 0, meetingsScheduled: 0, meetingsHeld: 0, noShow: 0,
      proposals: 0, proposalsInReview: 0, won: 0, lost: 0,
      conversionRate: 0, avgCycleDays: 0, avgTicket: 0, totalValue: 0,
    },
    movements: [],
    conversions: [],
    insights: [],
  }

  const teamId = context.activeTeamId
  if (!teamId) return empty

  // Fundação: os dados brutos virão daqui; o cálculo dos KPIs/movimentações/insights entra nesta camada.
  await getRawReportData(teamId, period)
  return empty
}
