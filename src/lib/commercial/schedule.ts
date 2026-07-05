import { dueDateFor } from '@/lib/commission/actions'

// Régua de cobrança do cliente — MESMA regra do agendador/cron (dueDateFor). Deriva as semanas VENCIDAS sem
// registro + a PRÓXIMA cobrança futura. Reusa a fonte canônica de vencimento (nada de reimplementar a data).
// Usado pela visão Financeira (team-level) e alinhado ao financeiro do cliente (ClientFinanceService).

export type ScheduleClient = { start_date: string | null; dia_pagamento_semana: number | null; plan_weekly: number | null; status: string | null }
export type ScheduleStatus = { valorSemanal: number; semanasVencidas: number; proximaCobranca: string | null }

const dow = (ymd: string): number => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

export function clientScheduleStatus(c: ScheduleClient, paidNums: Set<number>, todayYMD: string): ScheduleStatus {
  const valorSemanal = Number(c.plan_weekly) || 0
  if (c.status !== 'ativo' || !c.start_date) return { valorSemanal, semanasVencidas: 0, proximaCobranca: null }
  const start = String(c.start_date).slice(0, 10)
  const dia = c.dia_pagamento_semana ?? dow(start)
  // Semanas vencidas até hoje (vencimentos monotônicos) e quantas NÃO têm registro ativo (pendentes).
  let dueCount = 0
  for (let n = 1; n <= 520; n++) { if (dueDateFor(start, dia, n) <= todayYMD) dueCount = n; else break }
  let semanasVencidas = 0
  for (let n = 1; n <= dueCount; n++) if (!paidNums.has(n)) semanasVencidas++
  // Próxima cobrança FUTURA = vencimento da 1ª semana que ainda vai vencer (após hoje).
  const proximaCobranca = dueDateFor(start, dia, dueCount + 1)
  return { valorSemanal, semanasVencidas, proximaCobranca }
}
