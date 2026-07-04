import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { getActiveTeamMembers, getActiveTeamInvites, getTeamsOverview } from '@/server/services/TeamService'

// Painel administrativo com DADOS REAIS (ADMIN-REAL-001). Só LEITURA/agregação das tabelas que já existem —
// nada de nova arquitetura, domínio ou cálculo de regra. Tudo escopado à equipe ativa (team_id). Onde não há
// dado, o número é 0 de verdade (nunca fictício).

export type AdminMetric = { label: string; value: number | string; href?: string }
export type AdminMetricGroup = { title: string; metrics: AdminMetric[] }
export type AdminOverview = { groups: AdminMetricGroup[] }

const EMPTY: AdminOverview = { groups: [] }

// Contagem team-scoped (head:true → não transfere linhas). eqFilter = 1 filtro extra opcional (coluna, valor).
async function countTeam(
  supabase: ReturnType<typeof createClient>,
  table: string,
  teamId: string,
  eqFilter?: [string, unknown],
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('team_id', teamId)
  if (eqFilter) q = q.eq(eqFilter[0], eqFilter[1])
  const { count } = await q
  return count ?? 0
}

export async function getAdminOverview(context: RequestContext): Promise<AdminOverview> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY
  const supabase = createClient()

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)

  const [
    members, invites, teams,
    leads, clients, activeClients, meetings, tasks,
    sellers, activities, integrations,
    payments,
  ] = await Promise.all([
    getActiveTeamMembers(context),
    getActiveTeamInvites(context),
    getTeamsOverview(context),
    countTeam(supabase, 'leads', teamId),
    countTeam(supabase, 'clients', teamId),
    countTeam(supabase, 'clients', teamId, ['status', 'ativo']),
    countTeam(supabase, 'meetings', teamId),
    countTeam(supabase, 'tasks', teamId),
    countTeam(supabase, 'sellers', teamId),
    countTeam(supabase, 'activities', teamId),
    countTeam(supabase, 'client_integrations', teamId, ['ativo', true]),
    // Receita recebida = ledger de client_payments (não anulados). Poucas linhas → soma em JS.
    supabase.from('client_payments').select('valor_usd, paid_on, anulado').eq('team_id', teamId),
  ])

  // Equipe
  const owners = members.filter(m => m.role === 'owner').length
  const admins = members.filter(m => m.role === 'admin').length
  const membros = members.filter(m => m.role === 'member').length
  const now2 = now.toISOString()
  const convitesAtivos = invites.filter(i => !i.used_at && (i.expires_at ?? '') > now2).length
  const convitesExpirados = invites.filter(i => !i.used_at && (i.expires_at ?? '') <= now2).length

  // Financeiro (soma real do ledger, sem recalcular regra)
  const payRows = (payments.data ?? []) as { valor_usd: number | null; paid_on: string | null; anulado: boolean | null }[]
  const valid = payRows.filter(p => !p.anulado)
  const receitaMes = valid.filter(p => (p.paid_on ?? '') >= monthStart).reduce((s, p) => s + (Number(p.valor_usd) || 0), 0)
  const pagamentosSemana = valid.filter(p => (p.paid_on ?? '') >= weekAgo).length
  const usd = (n: number) => `US$ ${Math.round(n).toLocaleString('en-US')}`

  const leadsToClients = leads > 0 ? Math.round((clients / leads) * 100) : 0

  return {
    groups: [
      {
        title: 'Equipe',
        metrics: [
          { label: 'Colaboradores', value: members.length, href: '/admin/colaboradores' },
          { label: 'Owners', value: owners },
          { label: 'Admins', value: admins },
          { label: 'Membros', value: membros },
          { label: 'Equipes', value: teams.length, href: '/admin/equipe' },
          { label: 'Convites ativos', value: convitesAtivos, href: '/admin/equipe' },
          { label: 'Convites expirados', value: convitesExpirados },
        ],
      },
      {
        title: 'CRM',
        metrics: [
          { label: 'Leads', value: leads },
          { label: 'Clientes', value: clients },
          { label: 'Reuniões', value: meetings },
          { label: 'Tarefas', value: tasks },
          { label: 'Conversão lead→cliente', value: `${leadsToClients}%` },
        ],
      },
      {
        title: 'Financeiro',
        metrics: [
          { label: 'Vendedores', value: sellers, href: '/admin/remuneracao' },
          { label: 'Clientes ativos', value: activeClients },
          { label: 'Pagamentos (7 dias)', value: pagamentosSemana },
          { label: 'Receita recebida (mês)', value: usd(receitaMes) },
        ],
      },
      {
        title: 'Sistema',
        metrics: [
          { label: 'Atividades registradas', value: activities, href: '/admin/auditoria' },
          { label: 'Integrações ativas', value: integrations, href: '/admin/integracoes' },
        ],
      },
    ],
  }
}
