import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'
import { getCommercialRaw, getClientRevenueForMetrics, getExecutiveClients } from '@/server/repositories/CommercialMetricsRepository'
import { rangeFor, type Mode } from '@/lib/period'
import { dueDateFor } from '@/lib/commission/actions'
import { funnelConversionPct } from '@/lib/funnelMetrics'
import { receivedRevenueBetween, receivedRevenueBySeller, receivedRevenueByPlan, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { mrr as calcMrr, arr as calcArr, activeClientsCount, newClientsCount, mrrByPlan } from '@/core/metrics/portfolio'
import { closedValue, closedCount, averageTicket } from '@/core/metrics/sales'
import { ymd, todaySP, dowOfYmd } from '@/lib/date'

// ExecutiveMetricsService — CAMADA ÚNICA de leitura executiva (EXECUTIVE-METRICS-001, Parte 1). Todo dashboard,
// Hall, Financeiro, Relatórios, PDF, Administração e IA consomem ESTE serviço. Ele NÃO reimplementa nada:
// orquestra os repositórios já existentes (getCommercialRaw / getClientRevenueForMetrics / getExecutiveClients)
// e os primitivos PUROS de core/metrics (revenue/portfolio/sales) + funnelConversionPct + o cronograma canônico
// dueDateFor. Definições oficiais e consumidores em core/metrics/registry.ts. Team-scoped (TEAM-001).

// pad2/ymd/todaySP/dowOfYmd — fonte única em @/lib/date.

const EMPTY = (label: string, from: string, to: string): ExecutiveMetricsVM => ({
  periodLabel: label, from, to,
  receitaRecebida: 0, valorFechado: 0, receitaPrevista: 0, mrr: 0, arr: 0,
  ticketMedio: 0, conversao: 0, clientesAtivos: 0, clientesNovos: 0,
  receitaPorVendedor: [], receitaPorPlano: [], mrrPorPlano: [],
})

// Receita PREVISTA: soma, por cliente ativo, das cobranças AGENDADAS (dueDateFor) que caem depois de HOJE e
// até o fim do período, × valor semanal. Reusa o cronograma canônico (mesmo do cron/ClientFinance).
function forecastRevenue(
  clients: { status: string | null; plan_weekly: number | null; start_date: string | null; dia_pagamento_semana: number | null }[],
  afterYMD: string, throughYMD: string,
): number {
  if (throughYMD <= afterYMD) return 0
  let total = 0
  for (const c of clients) {
    if (c.status !== 'ativo' || !c.start_date) continue
    const start = String(c.start_date).slice(0, 10)
    const weekly = Number(c.plan_weekly) || 0
    if (weekly <= 0) continue
    const dia = c.dia_pagamento_semana ?? dowOfYmd(start)
    for (let n = 1; n <= 520; n++) {
      const due = dueDateFor(start, dia, n)
      if (due > throughYMD) break
      if (due > afterYMD) total += weekly
    }
  }
  return Math.round((total + Number.EPSILON) * 100) / 100
}

// Período: um preset (Mode → rangeFor) OU uma janela custom já em YMD (relatório personalizado). Mesma fonte.
export type ExecutivePeriod = Mode | { from: string; to: string; label: string }

export async function getExecutiveMetrics(context: RequestContext, period: ExecutivePeriod = 'mes'): Promise<ExecutiveMetricsVM> {
  let from: string, to: string, label: string
  if (typeof period === 'string') { const r = rangeFor(period); from = ymd(r.start); to = ymd(r.end); label = r.label }
  else { from = period.from; to = period.to; label = period.label }
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY(label, from, to)

  const [raw, revenue, carteira] = await Promise.all([
    getCommercialRaw(teamId),           // leads + deals (valor fechado / conversão)
    getClientRevenueForMetrics(),       // client_payments (receita recebida / por vendedor / por plano)
    getExecutiveClients(teamId),        // clients + plans (MRR/ARR / ativos / novos / previsão / dimensões)
  ])
  return composeExecutiveMetrics(raw, revenue, carteira, from, to, label)
}

// Tipos das leituras já existentes (sem novo import) — a composição é PURA e reutilizável sem recarregar.
type ExecRaw = Awaited<ReturnType<typeof getCommercialRaw>>
type ExecRevenue = Awaited<ReturnType<typeof getClientRevenueForMetrics>>
type ExecCarteira = Awaited<ReturnType<typeof getExecutiveClients>>

// Composição PURA do VM executivo a partir dos dados JÁ carregados (raw/revenue/carteira). FONTE ÚNICA da
// matemática executiva — o FinancialService e o DashboardService chamam ISTO com os MESMOS dados que já leram,
// eliminando a dupla-carga de client_payments/clients (perf) sem divergir os números.
export function composeExecutiveMetrics(raw: ExecRaw, revenue: ExecRevenue, carteira: ExecCarteira, from: string, to: string, label: string): ExecutiveMetricsVM {
  const planName = new Map(carteira.plans.map(p => [p.id, p.nome]))
  const clientToSeller = new Map(carteira.clients.map(c => [c.id, c.assigned_name || 'Sem responsável']))
  const clientToPlanId = new Map<string, string | null>(carteira.clients.map(c => [c.id, c.plano_id]))
  const payments = revenue.payments as PaymentRowWithClient[]
  // Conversão do PERÍODO: leads que CHEGARAM no intervalo — ESTRITO por received_at (nunca created_at).
  const periodLeads = raw.leads.filter(l => { const d = (l.received_at ?? '').slice(0, 10); return !!d && d >= from && d <= to })
  const mrrValue = calcMrr(carteira.clients)
  const valorFechado = closedValue(raw.deals, from, to)
  return {
    periodLabel: label, from, to,
    receitaRecebida: receivedRevenueBetween(payments, from, to),
    valorFechado,
    receitaPrevista: forecastRevenue(carteira.clients, todaySP(), to),
    mrr: mrrValue,
    arr: calcArr(mrrValue),
    ticketMedio: averageTicket(valorFechado, closedCount(raw.deals, from, to)),
    conversao: funnelConversionPct(periodLeads),
    clientesAtivos: activeClientsCount(carteira.clients),
    clientesNovos: newClientsCount(carteira.clients, from, to),
    receitaPorVendedor: receivedRevenueBySeller(payments, clientToSeller, from, to),
    receitaPorPlano: receivedRevenueByPlan(payments, planName, clientToPlanId, from, to),
    mrrPorPlano: mrrByPlan(carteira.clients, planName),
  }
}
