import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { composeExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import { getCommercialRaw, getClientRevenueForMetrics, getExecutiveClients } from '@/server/repositories/CommercialMetricsRepository'
import { clientsWithLatePay, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { rangeFor } from '@/lib/period'
import { ymd } from '@/lib/date'

// Cockpit operacional do Hall (DASHBOARD-REAL-001 → EXECUTIVE-METRICS-003). Os KPIs executivos vêm da FONTE
// ÚNICA (ExecutiveMetricsService) — exatamente os mesmos números do Dashboard Executivo, sem getCommercialDashboard
// e sem cálculo de KPI aqui. A parte OPERACIONAL (prioridades, alertas, clientes em atraso, integrações, tarefas)
// é agregada aqui porque o serviço executivo não a cobre. Team-scoped (TEAM-001).

export type DashKpi = { label: string; value: number | string; href?: string }
export type DashKpiGroup = { title: string; kpis: DashKpi[] }
export type DashAlert = { message: string; href?: string }
export type DashRevenueRow = { label: string; value: number; count: number }
export type DashboardData = {
  kpiGroups: DashKpiGroup[]
  alerts: DashAlert[]
  receitaPorVendedor: DashRevenueRow[]
  receitaPorPlano: DashRevenueRow[]
}

export const EMPTY_DASHBOARD: DashboardData = {
  kpiGroups: [], alerts: [], receitaPorVendedor: [], receitaPorPlano: [],
}

const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`

export async function getDashboardData(context: RequestContext): Promise<DashboardData> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY_DASHBOARD
  const supabase = createClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const staleDay = new Date(now.getTime() - 9 * 86_400_000).toISOString().slice(0, 10)   // pagamento semanal: gap > 9 dias
  const canManage = can(context, 'teams', 'manage')

  // Carrega UMA vez (mesma fonte do Dashboard) e compõe os KPIs aqui — sem chamar getExecutiveMetrics (que
  // recarregaria payments/clients). client_payments deixa de ser lido 2× no Hall. Números idênticos.
  const mRange = rangeFor('mes')
  const [raw, revenue, carteira, integrationsOnRes, integrationsOffRes, openTasksRes, invitesRes] = await Promise.all([
    getCommercialRaw(teamId),
    getClientRevenueForMetrics(),
    getExecutiveClients(teamId),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', true),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', false),
    supabase.from('tasks').select('id, due_date', { count: 'exact' }).eq('team_id', teamId).eq('done', false),
    canManage
      ? supabase.from('team_invites').select('id, used_at, expires_at').eq('team_id', teamId)
      : Promise.resolve({ data: [] as { id: string; used_at: string | null; expires_at: string | null }[] }),
  ])
  const exec = composeExecutiveMetrics(raw, revenue, carteira, ymd(mRange.start), ymd(mRange.end), mRange.label)

  // ── Operacional: clientes com pagamento em atraso (gap > 9 dias) — FONTE ÚNICA (mesma do Financeiro) ──
  const clientesEmAtraso = clientsWithLatePay(revenue.payments as PaymentRowWithClient[], staleDay)

  const integrationsOn = integrationsOnRes.count ?? 0
  const integrationsOff = integrationsOffRes.count ?? 0
  const openTasks = openTasksRes.count ?? 0
  const overdueTasks = (openTasksRes.data ?? []).filter(task => task.due_date && task.due_date < today).length
  const invites = (invitesRes.data ?? []) as { used_at: string | null; expires_at: string | null }[]
  const expiredInvites = invites.filter(i => !i.used_at && (i.expires_at ?? '') <= now.toISOString()).length

  // ── Alertas (só quando HÁ) ──
  const alerts: DashAlert[] = []
  if (clientesEmAtraso > 0) alerts.push({ message: `${clientesEmAtraso} cliente(s) ativo(s) sem pagamento recente.`, href: '/admin/clientes' })
  if (integrationsOff > 0) alerts.push({ message: `${integrationsOff} integração(ões) desligada(s).`, href: '/admin/clientes' })
  if (canManage && expiredInvites > 0) alerts.push({ message: `${expiredInvites} convite(s) expirado(s).`, href: '/admin/equipe' })
  if (overdueTasks >= 10) alerts.push({ message: `${overdueTasks} tarefas realmente atrasadas.`, href: '/tarefas' })

  return {
    kpiGroups: [
      {
        title: 'Receita',
        kpis: [
          { label: 'Receita Recebida', value: usd(exec.receitaRecebida), href: '/admin/clientes' },
          { label: 'Receita Prevista', value: usd(exec.receitaPrevista), href: '/admin/clientes' },
          { label: 'Valor Fechado', value: usd(exec.valorFechado), href: '/comercial' },
          { label: 'MRR', value: usd(exec.mrr), href: '/admin/clientes' },
          { label: 'ARR', value: usd(exec.arr), href: '/admin/clientes' },
        ],
      },
      {
        title: 'Comercial & carteira',
        kpis: [
          { label: 'Conversão', value: `${Math.round(exec.conversao)}%`, href: '/comercial' },
          { label: 'Ticket Médio', value: usd(exec.ticketMedio), href: '/comercial' },
          { label: 'Clientes Ativos', value: exec.clientesAtivos, href: '/admin/clientes' },
          { label: 'Clientes Novos', value: exec.clientesNovos, href: '/admin/clientes' },
        ],
      },
      {
        title: 'Operação',
        kpis: [
          { label: 'Integrações ativas', value: integrationsOn, href: '/admin/clientes' },
          { label: 'Compromissos abertos', value: openTasks, href: '/tarefas' },
          { label: 'Clientes em atraso', value: clientesEmAtraso, href: '/admin/clientes' },
        ],
      },
    ],
    alerts,
    receitaPorVendedor: exec.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, count: s.count })),
    receitaPorPlano: exec.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, count: p.count })),
  }
}
