'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { buildCommercialReport } from '@/server/services/ReportingService'
import type { CommercialReport, ReportPeriod } from '@/core/reporting/types'

// Server Action do relatório (ARCH-001). O PDF (cliente) NUNCA calcula nem consulta o Supabase — recebe pronto
// o view-model do ReportingService (period-scoped, fonte única). O relatório respeita EXATAMENTE a janela
// selecionada; por isso NÃO puxa mais o DashboardVM all-time, que vazava números fora do período (P3).
export type ReportResult =
  | { ok: true; report: CommercialReport; workspace: string | null; user: string | null }
  | { ok: false; error: string }

export async function getCommercialReportAction(period: ReportPeriod): Promise<ReportResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  // Autoridade de acesso (PERMISSIONS-002): o relatório comercial exige nível ≥ Somente leitura no Comercial.
  if (!can(context, 'commercial', 'view')) return { ok: false, error: 'Você não tem acesso ao relatório comercial.' }
  try {
    const report = await buildCommercialReport(context, period)
    return { ok: true, report, workspace: context.activeTeamName, user: context.profile?.name ?? null }
  } catch {
    return { ok: false, error: 'Não foi possível gerar o relatório.' }
  }
}
