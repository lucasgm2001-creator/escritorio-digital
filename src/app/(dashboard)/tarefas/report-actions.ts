'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { getExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import type { CommercialReport, ReportPeriod } from '@/core/reporting/types'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'

// Server Action ÚNICA do relatório (EXECUTIVE-METRICS-004). A TELA e o PDF consomem EXATAMENTE o mesmo
// { exec, report } → batem 1:1 por construção. exec = ExecutiveMetricsService (fonte única executiva:
// receita recebida/prevista, valor fechado, MRR/ARR, ticket, conversão, por vendedor/plano); report =
// ReportingService (funil/movimentações/insights, period-scoped). O cliente NUNCA calcula nem consulta (ARCH-001).
export type ExecReportResult =
  | { ok: true; exec: ExecutiveMetricsVM; report: CommercialReport; workspace: string | null; user: string | null }
  | { ok: false; error: string }

export async function getExecutiveReportAction(input: { fromYMD: string; toYMD: string; label: string }): Promise<ExecReportResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  // Autoridade (PERMISSIONS-002): o relatório comercial exige nível ≥ Somente leitura no Comercial.
  if (!can(context, 'commercial', 'view')) return { ok: false, error: 'Você não tem acesso ao relatório comercial.' }
  try {
    // Mesma janela (YMD → local) para as duas fontes: exec por YMD, report por ISO local. Batem 1:1.
    const period: ReportPeriod = { from: `${input.fromYMD}T00:00:00`, to: `${input.toYMD}T23:59:59.999`, label: input.label }
    const [exec, report] = await Promise.all([
      getExecutiveMetrics(context, { from: input.fromYMD, to: input.toYMD, label: input.label }),
      buildCommercialReport(context, period),
    ])
    return { ok: true, exec, report, workspace: context.activeTeamName, user: context.profile?.name ?? null }
  } catch {
    return { ok: false, error: 'Não foi possível gerar o relatório.' }
  }
}
