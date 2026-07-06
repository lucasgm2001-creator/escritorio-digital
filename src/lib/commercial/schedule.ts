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

// ── Estado de cada COBRANÇA (OPERATION-CRM-002, Part 4 — Stripe-ready) ──
// Hoje o estado é DERIVADO do cronograma (dueDateFor) + registro em client_payments. Quando o Stripe entrar,
// só troca a origem do estado (webhook paid/upcoming/failed → estes mesmos 4 estados) — sem retrabalho.
// 'cancelada' já FAZ PARTE do contrato (preparação Stripe): hoje a derivação nunca a produz (não há origem de
// cancelamento); quando o Stripe entrar, o webhook (canceled/void) preenche este estado — sem mudar o tipo.
export type ChargeState = 'prevista' | 'aguardando' | 'recebida' | 'atrasada' | 'cancelada'
export type Charge = { numeroSemana: number; dueYMD: string; valor: number; state: ChargeState }

const ATRASO_GRACE_DAYS = 9 // mesma régua do "cliente em atraso" (gap > 9 dias)
const minusDays = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - days)
  return dt.toISOString().slice(0, 10)
}

// Cobranças do cliente com vencimento em [fromYMD, toYMD], cada uma com seu estado:
//  recebida = tem pagamento · prevista = ainda vai vencer · aguardando = venceu há ≤9d sem pagar ·
//  atrasada = venceu há >9d sem pagar.
export function clientChargesBetween(c: ScheduleClient, paidNums: Set<number>, todayYMD: string, fromYMD: string, toYMD: string): Charge[] {
  const valor = Number(c.plan_weekly) || 0
  if (c.status !== 'ativo' || !c.start_date || valor <= 0) return []
  const start = String(c.start_date).slice(0, 10)
  const dia = c.dia_pagamento_semana ?? dow(start)
  const graceCutoff = minusDays(todayYMD, ATRASO_GRACE_DAYS)
  const out: Charge[] = []
  for (let n = 1; n <= 520; n++) {
    const due = dueDateFor(start, dia, n)
    if (due > toYMD) break
    if (due < fromYMD) continue
    const state: ChargeState = paidNums.has(n) ? 'recebida'
      : due > todayYMD ? 'prevista'
        : due >= graceCutoff ? 'aguardando'
          : 'atrasada'
    out.push({ numeroSemana: n, dueYMD: due, valor, state })
  }
  return out
}
