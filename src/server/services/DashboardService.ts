import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { getExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'

// Cockpit operacional do Hall (DASHBOARD-REAL-001 → EXECUTIVE-METRICS-003). Os KPIs executivos vêm da FONTE
// ÚNICA (ExecutiveMetricsService) — exatamente os mesmos números do Dashboard Executivo, sem getCommercialDashboard
// e sem cálculo de KPI aqui. A parte OPERACIONAL (prioridades, alertas, clientes em atraso, integrações, tarefas)
// é agregada aqui porque o serviço executivo não a cobre. Team-scoped (TEAM-001).

export type DashKpi = { label: string; value: number | string; href?: string }
export type DashKpiGroup = { title: string; kpis: DashKpi[] }
export type DashAlert = { message: string; href?: string }
export type DashRevenueRow = { label: string; value: number; count: number }
export type DashboardData = {
  leadsAwaiting: { count: number; sample: { id: string; name: string }[] }
  kpiGroups: DashKpiGroup[]
  alerts: DashAlert[]
  receitaPorVendedor: DashRevenueRow[]
  receitaPorPlano: DashRevenueRow[]
}

export const EMPTY_DASHBOARD: DashboardData = {
  leadsAwaiting: { count: 0, sample: [] }, kpiGroups: [], alerts: [], receitaPorVendedor: [], receitaPorPlano: [],
}

const TERMINAL = new Set(['fechado', 'perdido', 'lixeira'])
const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`

export async function getDashboardData(context: RequestContext): Promise<DashboardData> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY_DASHBOARD
  const supabase = createClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const staleDay = new Date(now.getTime() - 9 * 86_400_000).toISOString().slice(0, 10)   // pagamento semanal: gap > 9 dias
  const canManage = can(context, 'teams', 'manage')

  const [exec, openLeadsRes, integrationsOnRes, integrationsOffRes, paymentsRes, openTasksRes, invitesRes] = await Promise.all([
    getExecutiveMetrics(context, 'mes'),   // FONTE ÚNICA: receita/valor fechado/MRR/ARR/conversão/ticket/clientes/por vendedor/plano
    supabase.from('leads').select('id, name, status, next_contact, last_contact_at').eq('team_id', teamId).limit(500),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', true),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', false),
    supabase.from('client_payments').select('client_id, paid_on, anulado').eq('team_id', teamId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('done', false),
    canManage
      ? supabase.from('team_invites').select('id, used_at, expires_at').eq('team_id', teamId)
      : Promise.resolve({ data: [] as { id: string; used_at: string | null; expires_at: string | null }[] }),
  ])

  // ── Prioridades: leads aguardando contato (follow-up vencido OU nunca contatado), fora dos terminais ──
  const openLeads = (openLeadsRes.data ?? []) as { id: string; name: string; status: string; next_contact: string | null; last_contact_at: string | null }[]
  const awaiting = openLeads.filter(l =>
    !TERMINAL.has(l.status) && ((l.next_contact != null && l.next_contact <= today) || l.last_contact_at == null))

  // ── Operacional: clientes com pagamento em atraso (gap > 9 dias) — última data de pagamento por cliente ──
  const payRows = (paymentsRes.data ?? []) as { client_id: string | null; paid_on: string | null; anulado: boolean | null }[]
  const lastPayByClient = new Map<string, string>()
  for (const p of payRows) {
    if (p.anulado || !p.client_id || !p.paid_on) continue
    const prev = lastPayByClient.get(p.client_id)
    if (!prev || p.paid_on > prev) lastPayByClient.set(p.client_id, p.paid_on)
  }
  const clientesEmAtraso = Array.from(lastPayByClient.values()).filter(last => last < staleDay).length

  const integrationsOn = integrationsOnRes.count ?? 0
  const integrationsOff = integrationsOffRes.count ?? 0
  const openTasks = openTasksRes.count ?? 0
  const invites = (invitesRes.data ?? []) as { used_at: string | null; expires_at: string | null }[]
  const expiredInvites = invites.filter(i => !i.used_at && (i.expires_at ?? '') <= now.toISOString()).length

  // ── Alertas (só quando HÁ) ──
  const alerts: DashAlert[] = []
  if (clientesEmAtraso > 0) alerts.push({ message: `${clientesEmAtraso} cliente(s) ativo(s) sem pagamento recente.`, href: '/admin/clientes' })
  if (integrationsOff > 0) alerts.push({ message: `${integrationsOff} integração(ões) desligada(s).`, href: '/admin/clientes' })
  if (canManage && expiredInvites > 0) alerts.push({ message: `${expiredInvites} convite(s) expirado(s).`, href: '/admin/equipe' })
  if (openTasks >= 10) alerts.push({ message: `${openTasks} tarefas pendentes acumuladas.`, href: '/tarefas' })

  return {
    leadsAwaiting: { count: awaiting.length, sample: awaiting.slice(0, 4).map(l => ({ id: l.id, name: l.name })) },
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
          { label: 'Tarefas pendentes', value: openTasks, href: '/tarefas' },
          { label: 'Clientes em atraso', value: clientesEmAtraso, href: '/admin/clientes' },
        ],
      },
    ],
    alerts,
    receitaPorVendedor: exec.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, count: s.count })),
    receitaPorPlano: exec.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, count: p.count })),
  }
}
