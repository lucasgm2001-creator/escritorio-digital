import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import { composeExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import { getCommercialRaw, getClientRevenueForMetrics, getExecutiveClients } from '@/server/repositories/CommercialMetricsRepository'
import { receivedRevenueBetween, receivedRevenueByForma, clientsWithLatePay, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { clientScheduleStatus, clientChargesBetween, type ChargeState } from '@/lib/commercial/schedule'
import { rangeFor } from '@/lib/period'

// Visão Financeira executiva team-level (EXECUTIVE-METRICS-005). NÃO é motor novo: os KPIs núcleo vêm de
// getExecutiveMetrics (fonte única — mesmos números de Hall/Dashboard/Relatórios/PDF) e as dimensões
// financeiras (forma de pagamento, semanal, evolução, atraso, próximos/pendentes) são derivadas dos MESMOS
// primitivos (core/metrics/revenue) + a régua canônica de cobrança (dueDateFor via clientScheduleStatus).
// Receita Recebida (client_payments) e Valor Fechado (deals) permanecem SEPARADOS.

export type RevenueRow = { label: string; value: number; count: number }
export type EvolutionPoint = { label: string; value: number }
export type UpcomingCharge = { client: string; dueYMD: string; valor: number }
export type ChargeSummary = { state: ChargeState; count: number; valor: number }  // cobranças do mês por estado (Stripe-ready)

export type FinancialViewVM = {
  hasData: boolean
  periodLabel: string
  receitaRecebida: number   // mês
  receitaSemanal: number    // semana atual
  receitaPrevista: number
  valorFechado: number
  mrr: number
  arr: number
  ticketMedio: number
  clientesAtivos: number
  clientesNovos: number
  receitaPorVendedor: { name: string; value: number; count: number }[]
  receitaPorPlano: { plan: string; value: number; count: number }[]
  receitaPorForma: RevenueRow[]
  evolucaoMensal: EvolutionPoint[]        // últimos 6 meses (recebida)
  clientesEmAtraso: number                // > 9 dias sem pagamento
  recebimentosPendentesUsd: number        // semanas vencidas sem registro × valor semanal
  proximosRecebimentos: UpcomingCharge[]  // próximas cobranças (top 8 por data)
  cobrancasPorEstado: ChargeSummary[]     // cobranças do mês por estado: prevista/aguardando/recebida/atrasada
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
const ymd = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const spToday = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const EMPTY: FinancialViewVM = {
  hasData: false, periodLabel: '', receitaRecebida: 0, receitaSemanal: 0, receitaPrevista: 0, valorFechado: 0,
  mrr: 0, arr: 0, ticketMedio: 0, clientesAtivos: 0, clientesNovos: 0, receitaPorVendedor: [], receitaPorPlano: [],
  receitaPorForma: [], evolucaoMensal: [], clientesEmAtraso: 0, recebimentosPendentesUsd: 0, proximosRecebimentos: [],
  cobrancasPorEstado: [],
}

export async function getFinancialView(context: RequestContext): Promise<FinancialViewVM> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY

  const now = new Date()
  const mRange = rangeFor('mes')
  const mStart = ymd(mRange.start)
  const mEnd = ymd(mRange.end)
  const wk = rangeFor('semana')
  const today = spToday()
  const staleDay = ymd(new Date(Date.now() - 9 * 86_400_000))   // pagamento semanal: gap > 9 dias = atraso

  // Carrega UMA vez e compõe o VM executivo aqui (sem chamar getExecutiveMetrics, que recarregaria payments/
  // clients) — mesma FONTE ÚNICA, sem dupla-carga. Os KPIs núcleo saem idênticos ao Hall/Dashboard.
  const [raw, revenue, carteira] = await Promise.all([
    getCommercialRaw(teamId),
    getClientRevenueForMetrics(),          // client_payments (+ numero_semana, plano_id)
    getExecutiveClients(teamId),           // clients (+ forma_pagamento, name)
  ])
  const exec = composeExecutiveMetrics(raw, revenue, carteira, mStart, mEnd, mRange.label)
  const payments = revenue.payments as PaymentRowWithClient[]

  // Receita por forma de pagamento (mês) + receita semanal — mesmos primitivos da receita por vendedor/plano.
  const clientToForma = new Map(carteira.clients.map(c => [c.id, (c.forma_pagamento && c.forma_pagamento.trim()) || 'Não definida']))
  const receitaPorForma = receivedRevenueByForma(payments, clientToForma, mStart, mEnd).map(f => ({ label: f.forma, value: f.value, count: f.count }))
  const receitaSemanal = receivedRevenueBetween(payments, ymd(wk.start), ymd(wk.end))

  // Evolução mensal — recebida nos últimos 6 meses.
  const evolucaoMensal: EvolutionPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const s = ymd(new Date(d.getFullYear(), d.getMonth(), 1))
    const e = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    evolucaoMensal.push({ label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, value: receivedRevenueBetween(payments, s, e) })
  }

  // Régua de cobrança: semanas pagas (numero_semana) por cliente.
  const paidNumsByClient = new Map<string, Set<number>>()
  for (const p of payments) {
    if (p.anulado) continue
    if (typeof p.numero_semana === 'number' && p.client_id) {
      const set = paidNumsByClient.get(p.client_id) ?? new Set<number>()
      set.add(p.numero_semana); paidNumsByClient.set(p.client_id, set)
    }
  }
  const clientesEmAtraso = clientsWithLatePay(payments, staleDay)   // FONTE ÚNICA (mesma do Hall)

  const chargeAgg = new Map<ChargeState, { count: number; valor: number }>()
  let recebimentosPendentesUsd = 0
  const proximos: UpcomingCharge[] = []
  for (const c of carteira.clients) {
    if (c.status !== 'ativo') continue
    const paidNums = paidNumsByClient.get(c.id) ?? new Set<number>()
    const st = clientScheduleStatus(c, paidNums, today)
    recebimentosPendentesUsd += st.semanasVencidas * st.valorSemanal
    if (st.proximaCobranca && st.valorSemanal > 0) proximos.push({ client: c.name || 'Cliente', dueYMD: st.proximaCobranca, valor: st.valorSemanal })
    // Estados das cobranças do MÊS corrente (prevista/aguardando/recebida/atrasada) — mesma régua dueDateFor.
    for (const ch of clientChargesBetween(c, paidNums, today, mStart, mEnd)) {
      const cur = chargeAgg.get(ch.state) ?? { count: 0, valor: 0 }
      cur.count += 1; cur.valor += ch.valor; chargeAgg.set(ch.state, cur)
    }
  }
  proximos.sort((a, b) => a.dueYMD.localeCompare(b.dueYMD))
  const cobrancasPorEstado = (['prevista', 'aguardando', 'recebida', 'atrasada', 'cancelada'] as ChargeState[])
    .map(s => ({ state: s, count: chargeAgg.get(s)?.count ?? 0, valor: round2(chargeAgg.get(s)?.valor ?? 0) }))

  return {
    hasData: true,
    periodLabel: exec.periodLabel,
    receitaRecebida: exec.receitaRecebida,
    receitaSemanal,
    receitaPrevista: exec.receitaPrevista,
    valorFechado: exec.valorFechado,
    mrr: exec.mrr,
    arr: exec.arr,
    ticketMedio: exec.ticketMedio,
    clientesAtivos: exec.clientesAtivos,
    clientesNovos: exec.clientesNovos,
    receitaPorVendedor: exec.receitaPorVendedor,
    receitaPorPlano: exec.receitaPorPlano,
    receitaPorForma,
    evolucaoMensal,
    clientesEmAtraso,
    recebimentosPendentesUsd: round2(recebimentosPendentesUsd),
    proximosRecebimentos: proximos.slice(0, 8),
    cobrancasPorEstado,
  }
}
