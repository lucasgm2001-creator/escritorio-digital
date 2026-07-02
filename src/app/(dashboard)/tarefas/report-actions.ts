'use server'

import { getRequestContext } from '@/server/context/request-context'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { getCommercialDashboard } from '@/server/services/DashboardMetricsService'
import type { CommercialReport, ReportPeriod } from '@/core/reporting/types'
import type { CommercialDashboardVM } from '@/core/metrics/types'

// Server Action do relatório (ARCH-001). O PDF (cliente) NUNCA calcula nem consulta o Supabase — ele
// recebe pronto os view-models dos Services (ReportingService + DashboardMetricsService), fonte única.
export type ReportResult =
  | { ok: true; report: CommercialReport; dashboard: CommercialDashboardVM; workspace: string | null; user: string | null }
  | { ok: false; error: string }

export async function getCommercialReportAction(period: ReportPeriod): Promise<ReportResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  try {
    const [report, dashboard] = await Promise.all([
      buildCommercialReport(context, period),
      getCommercialDashboard(context),
    ])
    return { ok: true, report, dashboard, workspace: context.activeTeamName, user: context.profile?.name ?? null }
  } catch {
    return { ok: false, error: 'Não foi possível gerar o relatório.' }
  }
}
