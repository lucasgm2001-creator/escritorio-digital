import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { composeExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { getCommercialRaw, getClientRevenueForMetrics, getExecutiveClients } from '@/server/repositories/CommercialMetricsRepository'
import { clientsWithLatePay, receivedRevenueBetween, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { rangeFor } from '@/lib/period'
import { ymd, previousWindowYmd, todaySP } from '@/lib/date'
import type { MetricTrend } from '@/components/ui/MetricCard'

// Painel da EMPRESA no Hall (HALL-EMPRESA-001). O Hall deixou de ser o lugar do trabalho do dia (tarefas e
// agenda moram no Follow-up do Comercial) e virou a visão geral da companhia: alertas, dinheiro, comercial do
// mês, carteira e receita dos últimos 12 meses.
//
// Mesmas fontes e a mesma régua de Resultados — comparação pelo previousWindowYmd (mês em andamento × mesmo
// trecho do mês anterior) —, então clicar num cartão do Hall leva a Resultados com o mesmo número e a mesma
// comparação. KPIs executivos: composeExecutiveMetrics sobre UMA carga (raw/revenue/carteira). Funil do mês:
// buildCommercialReport (mesma fonte dos cartões de funil de Resultados). Team-scoped (TEAM-001).

export type DashKpi = { label: string; value: number | string; href?: string; trend?: MetricTrend; subtitle?: string }
export type DashKpiGroup = { title: string; kpis: DashKpi[] }
export type DashAlert = { message: string; href?: string }
export type DashMonth = { key: string; label: string; value: number; partial: boolean }   // key = YYYY-MM
export type DashboardData = {
  pulse: { periodLabel: string; recebida: number; vendas: number; clientesAtivos: number } | null
  alerts: DashAlert[]
  kpiGroups: DashKpiGroup[]
  revenue12m: DashMonth[]
}

export const EMPTY_DASHBOARD: DashboardData = { pulse: null, alerts: [], kpiGroups: [], revenue12m: [] }

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const RESULTADOS = '/comercial?tab=resultados'

// Trend "vs. anterior" — diferença absoluta (mesma forma do Resultados).
const vs = (cur: number, prev: number, suffix?: string): MetricTrend =>
  ({ value: Math.round(cur) - Math.round(prev), suffix, label: 'vs. anterior' })

export async function getDashboardData(context: RequestContext): Promise<DashboardData> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY_DASHBOARD
  const supabase = createClient()
  const now = new Date()
  // "Hoje" e o mês são de BRASÍLIA, não do servidor (UTC na Vercel): entre 21h e 0h do último dia o servidor já
  // está no mês seguinte e o Hall mostrava o mês errado, divergindo de Resultados. Meio-dia evita virada de data.
  const today = todaySP()
  const nowSP = new Date(`${today}T12:00:00`)
  const staleDay = new Date(now.getTime() - 9 * 86_400_000).toISOString().slice(0, 10)   // pagamento semanal: gap > 9 dias
  const canManage = can(context, 'teams', 'manage')

  const mRange = rangeFor('mes', nowSP)
  const from = ymd(mRange.start), to = ymd(mRange.end)
  const prev = previousWindowYmd(from, to, { mode: 'mes', todayYMD: today })

  const [raw, revenue, carteira, integrationsOffRes, invitesRes, report] = await Promise.all([
    getCommercialRaw(teamId),
    getClientRevenueForMetrics(teamId),
    getExecutiveClients(teamId),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', false),
    canManage
      ? supabase.from('team_invites').select('id, used_at, expires_at').eq('team_id', teamId)
      : Promise.resolve({ data: [] as { id: string; used_at: string | null; expires_at: string | null }[] }),
    buildCommercialReport(context,
      { from: `${from}T00:00:00`, to: `${to}T23:59:59.999`, label: mRange.label },
      { from: `${prev.from}T00:00:00`, to: `${prev.to}T23:59:59.999`, label: 'período anterior' }),
  ])
  const exec = composeExecutiveMetrics(raw, revenue, carteira, from, to, mRange.label)
  const execPrev = composeExecutiveMetrics(raw, revenue, carteira, prev.from, prev.to, 'período anterior')
  const k = report.kpis
  const cmp = report.comparison

  // ── Clientes com pagamento em atraso (gap > 9 dias) — FONTE ÚNICA (mesma do Financeiro) ──
  const payments = revenue.payments as PaymentRowWithClient[]
  const clientesEmAtraso = clientsWithLatePay(payments, staleDay)
  const integrationsOff = integrationsOffRes.count ?? 0
  const invites = (invitesRes.data ?? []) as { used_at: string | null; expires_at: string | null }[]
  const expiredInvites = invites.filter(i => !i.used_at && (i.expires_at ?? '') <= now.toISOString()).length

  // Destinos só para quem consegue abrir: Financeiro é owner/dev (requireAdminManage); Clientes (onde vivem as
  // integrações de cliente) também abre para quem tem o módulo. Sem acesso → cartão sem link, não um beco.
  const isAdmin = canAccessAdmin(context)
  const financeiroHref = isAdmin ? '/admin/financeiro' : undefined
  const clientesHref = isAdmin || (context.moduleAccess.clientes ?? 'none') !== 'none' ? '/admin/clientes' : undefined

  // ── Alertas da EMPRESA (só quando há). Tarefa atrasada não entra: é trabalho pessoal, mora no Follow-up. ──
  const alerts: DashAlert[] = []
  if (clientesEmAtraso > 0) alerts.push({ message: `${clientesEmAtraso} cliente(s) ativo(s) sem pagamento recente.`, href: financeiroHref })
  if (integrationsOff > 0) alerts.push({ message: `${integrationsOff} integração(ões) desligada(s).`, href: clientesHref })
  if (canManage && expiredInvites > 0) alerts.push({ message: `${expiredInvites} convite(s) expirado(s).`, href: '/admin/equipe' })

  // ── Receita recebida mês a mês (12 meses, o corrente parcial) — mesma primitiva da Receita Recebida ──
  const revenue12m: DashMonth[] = []
  for (let i = 11; i >= 0; i--) {
    const start = new Date(nowSP.getFullYear(), nowSP.getMonth() - i, 1)
    const end = new Date(nowSP.getFullYear(), nowSP.getMonth() - i + 1, 0)
    revenue12m.push({
      key: ymd(start).slice(0, 7),
      label: MONTH_ABBR[start.getMonth()],
      value: receivedRevenueBetween(payments, ymd(start), ymd(end)),
      partial: i === 0,
    })
  }

  return {
    pulse: { periodLabel: mRange.label, recebida: exec.receitaRecebida, vendas: k.won, clientesAtivos: exec.clientesAtivos },
    alerts,
    kpiGroups: [
      {
        title: 'Dinheiro',
        kpis: [
          { label: 'Receita recebida', value: usd(exec.receitaRecebida), href: RESULTADOS, trend: vs(exec.receitaRecebida, execPrev.receitaRecebida) },
          { label: 'Receita prevista', value: usd(exec.receitaPrevista), href: financeiroHref, subtitle: 'a receber no mês' },
          { label: 'MRR', value: usd(exec.mrr), href: financeiroHref, subtitle: 'receita mensal recorrente' },
          { label: 'ARR', value: usd(exec.arr), href: financeiroHref, subtitle: 'MRR × 12' },
        ],
      },
      {
        title: 'Comercial no mês',
        kpis: [
          { label: 'Leads recebidos', value: k.newLeads, href: RESULTADOS, trend: cmp ? vs(k.newLeads, cmp.newLeads) : undefined },
          { label: 'Reuniões realizadas', value: k.meetingsHeld, href: RESULTADOS, trend: cmp ? vs(k.meetingsHeld, cmp.meetingsHeld) : undefined },
          { label: 'Vendas', value: k.won, href: RESULTADOS, trend: cmp ? vs(k.won, cmp.won) : undefined },
          { label: 'Conversão', value: `${Math.round(k.conversionRate * 100)}%`, href: RESULTADOS,
            trend: cmp ? vs(k.conversionRate * 100, cmp.conversionRate * 100, 'pp') : undefined },
        ],
      },
      {
        title: 'Carteira',
        kpis: [
          { label: 'Clientes ativos', value: exec.clientesAtivos, href: clientesHref },
          { label: 'Clientes novos', value: exec.clientesNovos, href: clientesHref, trend: vs(exec.clientesNovos, execPrev.clientesNovos) },
          { label: 'Clientes em atraso', value: clientesEmAtraso, href: financeiroHref, subtitle: 'sem pagamento há +9 dias' },
        ],
      },
    ],
    revenue12m,
  }
}
