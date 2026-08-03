import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'
import { getCommercialRaw, getClientRevenueForMetrics, getExecutiveClients, getMarketingInvestment, getMeetingsForMetrics, type MMeetingMetric } from '@/server/repositories/CommercialMetricsRepository'
import { rangeFor, type Mode } from '@/lib/period'
import { dueDateFor } from '@/lib/commission/actions'
import { funnelConversionPct } from '@/lib/funnelMetrics'
import { receivedRevenueBetween, receivedRevenueBySeller, receivedRevenueByPlan, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { mrr as calcMrr, arr as calcArr, activeClientsCount, newClientsCount, mrrByPlan } from '@/core/metrics/portfolio'
import { closedValue, closedCount, averageTicket } from '@/core/metrics/sales'
import { meetingCommissionCounts } from '@/lib/commission/constants'
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
  investimento: 0, cpl: null, custoPorReuniao: null, custoPorVenda: null, roi: null,
})

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

// Reuniões "realizadas" no período — MESMA regra do ReportKpis.meetingsHeld (ReportingService): met_on
// dentro da janela + gate de comissão (meetingCommissionCounts). Só assim "Custo por Reunião" bate com
// "Reuniões Realizadas" exibidas lado a lado no Dashboard/PDF.
function meetingsHeldCount(meetings: MMeetingMetric[], fromYMD: string, toYMD: string): number {
  return meetings.filter(m => {
    const d = (m.met_on ?? '').slice(0, 10)
    return !!d && d >= fromYMD && d <= toYMD && meetingCommissionCounts(m.met_on)
  }).length
}

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

  const [raw, revenue, carteira, investmentUsd, meetings] = await Promise.all([
    getCommercialRaw(teamId),           // leads + deals (valor fechado / conversão)
    getClientRevenueForMetrics(),       // client_payments (receita recebida / por vendedor / por plano)
    getExecutiveClients(teamId),        // clients + plans (MRR/ARR / ativos / novos / previsão / dimensões)
    getMarketingInvestment(teamId, from, to),  // Σ marketing_investments no período (Aquisição)
    getMeetingsForMetrics(teamId),              // reuniões do time (custo por reunião)
  ])
  return composeExecutiveMetrics(raw, revenue, carteira, from, to, label, { investmentUsd, meetings })
}

// Tipos das leituras já existentes (sem novo import) — a composição é PURA e reutilizável sem recarregar.
type ExecRaw = Awaited<ReturnType<typeof getCommercialRaw>>
type ExecRevenue = Awaited<ReturnType<typeof getClientRevenueForMetrics>>
type ExecCarteira = Awaited<ReturnType<typeof getExecutiveClients>>

// Composição PURA do VM executivo a partir dos dados JÁ carregados (raw/revenue/carteira). FONTE ÚNICA da
// matemática executiva — o FinancialService e o DashboardService chamam ISTO com os MESMOS dados que já leram,
// eliminando a dupla-carga de client_payments/clients (perf) sem divergir os números. `acquisition` é OPCIONAL
// (investimento/reuniões) — quem não passa (FinancialService/DashboardService) recebe investimento=0 e os
// custos/ROI em null, sem precisar carregar marketing_investments/meetings.
export function composeExecutiveMetrics(
  raw: ExecRaw, revenue: ExecRevenue, carteira: ExecCarteira, from: string, to: string, label: string,
  acquisition?: { investmentUsd: number; meetings: MMeetingMetric[] },
): ExecutiveMetricsVM {
  const planName = new Map(carteira.plans.map(p => [p.id, p.nome]))
  const clientToSeller = new Map(carteira.clients.map(c => [c.id, c.assigned_name || 'Sem responsável']))
  const clientToPlanId = new Map<string, string | null>(carteira.clients.map(c => [c.id, c.plano_id]))
  const payments = revenue.payments as PaymentRowWithClient[]
  // Conversão do PERÍODO: leads que CHEGARAM no intervalo — ESTRITO por received_at (nunca created_at).
  const periodLeads = raw.leads.filter(l => { const d = (l.received_at ?? '').slice(0, 10); return !!d && d >= from && d <= to })
  const mrrValue = calcMrr(carteira.clients)
  const valorFechado = closedValue(raw.deals, from, to)
  const receitaRecebida = receivedRevenueBetween(payments, from, to)
  const vendasCount = closedCount(raw.deals, from, to)

  // Aquisição — CPL/custo por reunião/venda/ROI. NUNCA divide por zero nem inventa número: sem denominador
  // (ou sem investimento) → null (a UI mostra "—", não "0"/"Infinity").
  const investimento = round2(acquisition?.investmentUsd ?? 0)
  const reunioesCount = meetingsHeldCount(acquisition?.meetings ?? [], from, to)
  const cpl = investimento > 0 && periodLeads.length > 0 ? round2(investimento / periodLeads.length) : null
  const custoPorReuniao = investimento > 0 && reunioesCount > 0 ? round2(investimento / reunioesCount) : null
  const custoPorVenda = investimento > 0 && vendasCount > 0 ? round2(investimento / vendasCount) : null
  const roi = investimento > 0 ? round2(receitaRecebida / investimento) : null

  return {
    periodLabel: label, from, to,
    receitaRecebida,
    valorFechado,
    receitaPrevista: forecastRevenue(carteira.clients, todaySP(), to),
    mrr: mrrValue,
    arr: calcArr(mrrValue),
    ticketMedio: averageTicket(valorFechado, vendasCount),
    conversao: funnelConversionPct(periodLeads),
    clientesAtivos: activeClientsCount(carteira.clients),
    clientesNovos: newClientsCount(carteira.clients, from, to),
    receitaPorVendedor: receivedRevenueBySeller(payments, clientToSeller, from, to),
    receitaPorPlano: receivedRevenueByPlan(payments, planName, clientToPlanId, from, to),
    mrrPorPlano: mrrByPlan(carteira.clients, planName),
    investimento, cpl, custoPorReuniao, custoPorVenda, roi,
  }
}
