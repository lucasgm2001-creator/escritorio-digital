import 'server-only'

import type { ReportPeriod } from '@/core/reporting/types'

// Acesso a dados brutos para relatórios (leads / stage_events / deals) — ARCH-001. STUB de fundação:
// retorna vazio. Futuro: consultas reais por team_id + período. O PDF nunca toca aqui: passa pelo Service.
export type RawReportData = {
  leads: unknown[]
  stageEvents: unknown[]
  deals: unknown[]
}

export async function getRawReportData(teamId: string, period: ReportPeriod): Promise<RawReportData> {
  void teamId
  void period // reservados: a consulta real (por equipe e período) chega quando o relatório for implementado
  return { leads: [], stageEvents: [], deals: [] }
}
