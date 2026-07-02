import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { DashboardMetrics } from '@/core/metrics/types'

// Fonte ÚNICA de KPIs do dashboard (ARCH-001). STUB de fundação: zeros tipados. A migração dos cálculos
// hoje espalhados (Hall, Comercial, Métricas) para cá é incremental e ADITIVA — não altera as telas atuais.
export async function getDashboardMetrics(context: RequestContext): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    sales: { won: 0, totalValue: 0, avgTicket: 0 },
    commercial: { totalLeads: 0, openLeads: 0, conversionRate: 0 },
    financial: { revenueForecast: 0, revenueReceived: 0 },
    activity: { activities: 0, tasksOpen: 0, meetingsToday: 0 },
  }

  if (!context.activeTeamId) return empty
  // Futuro: consolida SalesMetrics/CommercialMetrics/FinancialMetrics/ActivityMetrics por team_id.
  return empty
}
