import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { getCommercialDashboard } from '@/server/services/DashboardMetricsService'
import { receivedRevenueSince } from '@/core/metrics/revenue'

// Cockpit operacional do Hall (DASHBOARD-REAL-001). SÓ leitura/agregação de dados que já existem, escopado à
// equipe ativa. REUSA getCommercialDashboard (fonte única dos KPIs comerciais — mesmos números do /comercial),
// somando prioridades do dia + alertas. Sem nova arquitetura, sem cálculo de regra, sem número fictício.

export type DashKpi = { label: string; value: number | string; href?: string }
export type DashKpiGroup = { title: string; kpis: DashKpi[] }
export type DashAlert = { message: string; href?: string }
export type DashboardData = {
  leadsAwaiting: { count: number; sample: { id: string; name: string }[] }
  kpiGroups: DashKpiGroup[]
  alerts: DashAlert[]
}

const EMPTY: DashboardData = { leadsAwaiting: { count: 0, sample: [] }, kpiGroups: [], alerts: [] }

const TERMINAL = new Set(['fechado', 'perdido', 'lixeira'])
const usd = (n: number) => `US$ ${Math.round(n).toLocaleString('en-US')}`

export async function getDashboardData(context: RequestContext): Promise<DashboardData> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY
  const supabase = createClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const staleDay = new Date(now.getTime() - 9 * 86_400_000).toISOString().slice(0, 10)   // pagamento semanal: gap > 9 dias
  const canManage = can(context, 'teams', 'manage')

  const [
    commercial,
    openLeadsRes,
    activeClientsRes,
    integrationsOnRes,
    integrationsOffRes,
    paymentsRes,
    openTasksRes,
    invitesRes,
  ] = await Promise.all([
    getCommercialDashboard(context),
    supabase.from('leads').select('id, name, status, next_contact, last_contact_at').eq('team_id', teamId).limit(500),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'ativo'),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', true),
    supabase.from('client_integrations').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('ativo', false),
    supabase.from('client_payments').select('client_id, valor_usd, paid_on, anulado').eq('team_id', teamId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('done', false),
    canManage
      ? supabase.from('team_invites').select('id, used_at, expires_at').eq('team_id', teamId)
      : Promise.resolve({ data: [] as { id: string; used_at: string | null; expires_at: string | null }[] }),
  ])

  // ── Prioridades: leads aguardando contato (follow-up vencido OU nunca contatado), fora dos terminais ──
  const openLeads = (openLeadsRes.data ?? []) as { id: string; name: string; status: string; next_contact: string | null; last_contact_at: string | null }[]
  const awaiting = openLeads.filter(l =>
    !TERMINAL.has(l.status) && ((l.next_contact != null && l.next_contact <= today) || l.last_contact_at == null))
  const leadsNoContact = openLeads.filter(l => !TERMINAL.has(l.status) && l.last_contact_at == null).length

  // ── Financeiro: receita recebida no mês + clientes com pagamento em atraso (gap > 9 dias) ──
  const payRows = (paymentsRes.data ?? []) as { client_id: string | null; valor_usd: number | null; paid_on: string | null; anulado: boolean | null }[]
  const validPay = payRows.filter(p => !p.anulado)
  const receitaMes = receivedRevenueSince(payRows, monthStart)
  const lastPayByClient = new Map<string, string>()
  for (const p of validPay) {
    if (!p.client_id || !p.paid_on) continue
    const prev = lastPayByClient.get(p.client_id)
    if (!prev || p.paid_on > prev) lastPayByClient.set(p.client_id, p.paid_on)
  }
  const clientesEmAtraso = Array.from(lastPayByClient.values()).filter(last => last < staleDay).length

  const activeClients = activeClientsRes.count ?? 0
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
        title: 'Comercial',
        kpis: [
          { label: 'Leads novos (7d)', value: commercial.leadsNew, href: '/comercial' },
          { label: 'Leads sem contato', value: leadsNoContact, href: '/comercial' },
          { label: 'Reuniões', value: commercial.meetings, href: '/comercial' },
          { label: 'Propostas abertas', value: commercial.proposals, href: '/comercial' },
          { label: 'Conversão', value: `${Math.round(commercial.conversionRate)}%`, href: '/comercial' },
        ],
      },
      {
        title: 'Financeiro',
        kpis: [
          { label: 'Receita do mês', value: usd(receitaMes), href: '/admin/clientes' },
          { label: 'Receita realizada', value: usd(commercial.revenueRealized), href: '/comercial' },
          { label: 'Pipeline previsto', value: usd(commercial.pipelineValue), href: '/comercial' },
          { label: 'Clientes em atraso', value: clientesEmAtraso, href: '/admin/clientes' },
        ],
      },
      {
        title: 'Operação',
        kpis: [
          { label: 'Clientes ativos', value: activeClients, href: '/admin/clientes' },
          { label: 'Integrações ativas', value: integrationsOn, href: '/admin/clientes' },
          { label: 'Tarefas pendentes', value: openTasks, href: '/tarefas' },
        ],
      },
    ],
    alerts,
  }
}
