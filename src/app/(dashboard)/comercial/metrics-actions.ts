'use server'

import { getRequestContext } from '@/server/context/request-context'
import { getCommercialMetricsTab, EMPTY_METRICS_TAB } from '@/server/services/CommercialMetricsService'
import type { Mode } from '@/lib/period'
import type { CommercialMetricsTabVM } from '@/core/metrics/types'

// UI → Server Action → Service → Repository → Supabase (ARCH-001). A aba Métricas chama esta action
// quando o período muda; recebe o view-model PRONTO e apenas renderiza.
export async function getCommercialMetricsTabAction(mode: Mode): Promise<CommercialMetricsTabVM> {
  const context = await getRequestContext()
  if (!context) return EMPTY_METRICS_TAB
  return getCommercialMetricsTab(context, mode)
}
