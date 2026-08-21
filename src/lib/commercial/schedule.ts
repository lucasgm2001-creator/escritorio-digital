import { dueDateFor } from '@/lib/commission/actions'
import { dowOfYmd, addDaysYmd } from '@/lib/date'

// Régua de cobrança do cliente — MESMA regra do agendador/cron (dueDateFor). Deriva as semanas VENCIDAS sem
// registro + a PRÓXIMA cobrança futura. Reusa a fonte canônica de vencimento (nada de reimplementar a data).
// Usado pela visão Financeira (team-level) e alinhado ao financeiro do cliente (ClientFinanceService).
//
// ÂNCORA (P1-ANCORA-001): o vencimento conta a partir de `billing_anchor_date ?? start_date` — a MESMA
// expressão do cron (auto-weeks), do scheduleDueWeeks e do ClientFinanceService. Antes daqui só saía
// start_date, então o Financeiro calculava vencimento diferente do robô assim que a semana 1 fosse
// confirmada num dia diferente do início do contrato.

// billing_anchor_date = dia REAL em que a semana 1 foi paga (ClientPaymentsPanel grava ao confirmar a
// semana 1). É a âncora canônica da régua; start_date é só o fallback de quem ainda não teve a 1ª confirmada.
// Opcional no tipo para não quebrar chamador que ainda não carregue a coluna — sem ela, cai no start_date,
// que é exatamente o comportamento anterior.
export type ScheduleClient = { start_date: string | null; billing_anchor_date?: string | null; dia_pagamento_semana: number | null; plan_weekly: number | null; status: string | null }
// semanasVencidasNums = QUAIS semanas estão vencidas sem registro ativo (não só quantas). Quem precifica o
// pendente usa os números para buscar o valor CONGELADO de cada semana em vez de multiplicar pelo plano atual.
export type ScheduleStatus = { valorSemanal: number; semanasVencidas: number; semanasVencidasNums: number[]; proximaCobranca: string | null }

export function clientScheduleStatus(c: ScheduleClient, paidNums: Set<number>, todayYMD: string): ScheduleStatus {
  const valorSemanal = Number(c.plan_weekly) || 0
  const anchor = c.billing_anchor_date ?? c.start_date
  if (c.status !== 'ativo' || !anchor) return { valorSemanal, semanasVencidas: 0, semanasVencidasNums: [], proximaCobranca: null }
  const start = String(anchor).slice(0, 10)
  const dia = c.dia_pagamento_semana ?? dowOfYmd(start)
  // Semanas vencidas até hoje (vencimentos monotônicos) e quantas NÃO têm registro ativo (pendentes).
  let dueCount = 0
  for (let n = 1; n <= 520; n++) { if (dueDateFor(start, dia, n) <= todayYMD) dueCount = n; else break }
  const semanasVencidasNums: number[] = []
  for (let n = 1; n <= dueCount; n++) if (!paidNums.has(n)) semanasVencidasNums.push(n)
  // Próxima cobrança FUTURA = vencimento da 1ª semana que ainda vai vencer (após hoje).
  const proximaCobranca = dueDateFor(start, dia, dueCount + 1)
  return { valorSemanal, semanasVencidas: semanasVencidasNums.length, semanasVencidasNums, proximaCobranca }
}

// ── Estado de cada COBRANÇA (OPERATION-CRM-002, Part 4 — Stripe-ready) ──
// Hoje o estado é DERIVADO do cronograma (dueDateFor) + registro em client_payments. Quando o Stripe entrar,
// só troca a origem do estado (webhook paid/upcoming/failed → estes mesmos 4 estados) — sem retrabalho.
// 'cancelada' já FAZ PARTE do contrato (preparação Stripe): hoje a derivação nunca a produz (não há origem de
// cancelamento); quando o Stripe entrar, o webhook (canceled/void) preenche este estado — sem mudar o tipo.
export type ChargeState = 'prevista' | 'aguardando' | 'recebida' | 'atrasada' | 'cancelada'
export type Charge = { numeroSemana: number; dueYMD: string; valor: number; state: ChargeState }

const ATRASO_GRACE_DAYS = 9 // mesma régua do "cliente em atraso" (gap > 9 dias)

// Cobranças do cliente com vencimento em [fromYMD, toYMD], cada uma com seu estado:
//  recebida = tem pagamento · prevista = ainda vai vencer · aguardando = venceu há ≤9d sem pagar ·
//  atrasada = venceu há >9d sem pagar.
export function clientChargesBetween(c: ScheduleClient, paidNums: Set<number>, todayYMD: string, fromYMD: string, toYMD: string): Charge[] {
  const valor = Number(c.plan_weekly) || 0
  const anchor = c.billing_anchor_date ?? c.start_date
  if (c.status !== 'ativo' || !anchor || valor <= 0) return []
  const start = String(anchor).slice(0, 10)
  const dia = c.dia_pagamento_semana ?? dowOfYmd(start)
  const graceCutoff = addDaysYmd(todayYMD, -ATRASO_GRACE_DAYS)
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
