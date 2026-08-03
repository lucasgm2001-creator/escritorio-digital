'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { getExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import { buildCommercialReport } from '@/server/services/ReportingService'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'
import type { CommercialReport } from '@/core/reporting/types'

// UI → Server Action → Service (ARCH-001). A aba "Visão Geral" (ex-rota /comercial/dashboard) chama esta
// action no mount; devolve o MESMO { vm, weekReceita, report } que a rota antiga montava — getExecutiveMetrics
// + buildCommercialReport, período fixo "mês atual". Nenhum cálculo novo: só mudou de onde é chamado.
export type VisaoGeralResult =
  | { ok: true; vm: ExecutiveMetricsVM; weekReceita: number; report: CommercialReport }
  | { ok: false }

export async function getVisaoGeralAction(): Promise<VisaoGeralResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false }
  // Autoridade de acesso (PERMISSIONS-002): ver a Visão Geral do Comercial exige nível ≥ Somente leitura.
  if (!can(context, 'commercial', 'view')) return { ok: false }

  const now = new Date()
  const period = {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
    label: 'Este mês',
  }
  const [vm, weekVm, report] = await Promise.all([
    getExecutiveMetrics(context, 'mes'),
    getExecutiveMetrics(context, 'semana'),
    buildCommercialReport(context, period),
  ])
  return { ok: true, vm, weekReceita: weekVm.receitaRecebida, report }
}
