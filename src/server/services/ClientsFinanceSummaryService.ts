import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import { createClient } from '@/lib/supabase/server'
import { dueDateFor } from '@/lib/commission/actions'
import { toPaymentPeriods, type PaymentPeriod } from '@/lib/commercial/payment-periods'
import { todaySP, dowOfYmd } from '@/lib/date'
import { receivedRevenue } from '@/core/metrics/revenue'

// Resumo financeiro de TODOS os clientes da equipe numa passada (PRODUCT-SPRINT-003, Parte 5). Reusa a MESMA
// regra de vencimento (dueDateFor) do ClientFinanceService/cron e o MESMO agrupador (toPaymentPeriods) — sem
// motor novo e sem N+1: 1 query de client_payments + os clientes. Só leitura, team-scoped (RLS). Serve a lista
// Administração → Clientes para "entender em segundos" (total recebido, próxima cobrança, pendências, histórico).
export type ClientFinanceSummary = {
  totalRecebido: number
  pagos: number                 // períodos pagos (semanas ou meses, conforme periodicidade)
  pendentes: number             // semanas vencidas sem pagamento (base do motor = semana)
  ultimoPagamento: string | null
  proximaCobranca: string | null
  periods: PaymentPeriod[]      // histórico já agrupado (semana × mês) — mais recente primeiro
}

// todaySP + dowOfYmd — fonte única @/lib/date.

export async function getClientsFinanceSummary(context: RequestContext): Promise<Record<string, ClientFinanceSummary>> {
  const teamId = context.activeTeamId
  if (!teamId) return {}
  const supabase = createClient()
  const [clientsRes, paysRes] = await Promise.all([
    supabase.from('clients').select('id, start_date, dia_pagamento_semana, status, periodicidade').eq('team_id', teamId).is('deleted_at', null),
    supabase.from('client_payments').select('client_id, numero_semana, valor_usd, paid_on, anulado').eq('team_id', teamId),
  ])

  const byClient = new Map<string, { numeroSemana: number; valorUsd: number; paidOn: string | null; anulado: boolean }[]>()
  for (const p of paysRes.data ?? []) {
    const arr = byClient.get(p.client_id) ?? []
    arr.push({ numeroSemana: Number(p.numero_semana), valorUsd: Number(p.valor_usd ?? 0), paidOn: p.paid_on ?? null, anulado: !!p.anulado })
    byClient.set(p.client_id, arr)
  }

  const today = todaySP()
  const out: Record<string, ClientFinanceSummary> = {}
  for (const c of clientsRes.data ?? []) {
    const list = byClient.get(c.id) ?? []
    const active = list.filter(p => !p.anulado)
    const periodicidade = (c.periodicidade === 'mensal' ? 'mensal' : 'semanal') as 'semanal' | 'mensal'
    const totalRecebido = receivedRevenue(list.map(p => ({ valor_usd: p.valorUsd, paid_on: p.paidOn, anulado: p.anulado })))
    const paidNums = new Set(active.map(p => p.numeroSemana))
    const ultimoPagamento = active.map(p => p.paidOn).filter((d): d is string => !!d).sort().pop() ?? null

    let pendentes = 0
    let proximaCobranca: string | null = null
    const start = c.start_date ? String(c.start_date).slice(0, 10) : null
    if (start && c.status === 'ativo') {
      const dia = c.dia_pagamento_semana ?? dowOfYmd(start)
      let dueCount = 0
      for (let n = 1; n <= 520; n++) { if (dueDateFor(start, dia, n) <= today) dueCount = n; else break }
      for (let n = 1; n <= dueCount; n++) if (!paidNums.has(n)) pendentes++
      let n = 1; while (paidNums.has(n)) n++
      proximaCobranca = dueDateFor(start, dia, n)
    }

    out[c.id] = { totalRecebido, pagos: active.length, pendentes, ultimoPagamento, proximaCobranca, periods: toPaymentPeriods(list, periodicidade) }
  }
  return out
}
