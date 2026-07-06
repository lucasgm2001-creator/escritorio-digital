'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { getExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import type { CommercialReport, ReportPeriod } from '@/core/reporting/types'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'
import { addDaysYmd } from '@/lib/date'

// Server Action ÚNICA do relatório (EXECUTIVE-METRICS-004). A TELA e o PDF consomem EXATAMENTE o mesmo
// { exec, report } → batem 1:1 por construção. exec = ExecutiveMetricsService (fonte única executiva:
// receita recebida/prevista, valor fechado, MRR/ARR, ticket, conversão, por vendedor/plano); report =
// ReportingService (funil/movimentações/insights, period-scoped). O cliente NUNCA calcula nem consulta (ARCH-001).
export type ExecReportResult =
  | { ok: true; exec: ExecutiveMetricsVM; execPrev: ExecutiveMetricsVM; report: CommercialReport; workspace: string | null; user: string | null }
  | { ok: false; error: string }

const DAY = 86_400_000

export async function getExecutiveReportAction(input: { fromYMD: string; toYMD: string; label: string }): Promise<ExecReportResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  // Autoridade (PERMISSIONS-002): o relatório comercial exige nível ≥ Somente leitura no Comercial.
  if (!can(context, 'commercial', 'view')) return { ok: false, error: 'Você não tem acesso ao relatório comercial.' }
  try {
    // Janela ANTERIOR de mesma duração, imediatamente antes (semanal→semana anterior; mensal→mês anterior;
    // personalizado→janela anterior do mesmo tamanho). Comparativo (Parte 4). Mesma janela p/ exec e report → 1:1.
    const sizeDays = Math.round((Date.parse(input.toYMD) - Date.parse(input.fromYMD)) / DAY) + 1
    const prevToYMD = addDaysYmd(input.fromYMD, -1)
    const prevFromYMD = addDaysYmd(input.fromYMD, -sizeDays)
    const period: ReportPeriod = { from: `${input.fromYMD}T00:00:00`, to: `${input.toYMD}T23:59:59.999`, label: input.label }
    const prevPeriod: ReportPeriod = { from: `${prevFromYMD}T00:00:00`, to: `${prevToYMD}T23:59:59.999`, label: 'período anterior' }
    const [exec, execPrev, report] = await Promise.all([
      getExecutiveMetrics(context, { from: input.fromYMD, to: input.toYMD, label: input.label }),
      getExecutiveMetrics(context, { from: prevFromYMD, to: prevToYMD, label: 'período anterior' }),
      buildCommercialReport(context, period, prevPeriod),
    ])
    return { ok: true, exec, execPrev, report, workspace: context.activeTeamName, user: context.profile?.name ?? null }
  } catch {
    return { ok: false, error: 'Não foi possível gerar o relatório.' }
  }
}
