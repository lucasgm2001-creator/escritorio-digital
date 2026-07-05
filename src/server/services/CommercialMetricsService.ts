import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialMetricsTabVM } from '@/core/metrics/types'
import {
  getCommercialRaw, getLeadMilestonesForMetrics, getClientRevenueForMetrics,
} from '@/server/repositories/CommercialMetricsRepository'
import { rangeFor, type Mode } from '@/lib/period'
import { ymd } from '@/lib/format'
import { ALL_COLUMNS } from '@/app/(dashboard)/comercial/types'

// KPIs da aba Métricas (CRM-RC-002). MESMA lógica que a UI fazia — apenas movida para a camada correta
// (ARCH-001, TEAM-001). Período resolvido no servidor via rangeFor(mode); fontes: leads (team-scoped) +
// lead_milestones + client_payments (RLS). Nada é recalculado na tela.
const isTerminal = (s: string | null): boolean => s === 'fechado' || s === 'perdido' || s === 'lixeira'

export const EMPTY_METRICS_TAB: CommercialMetricsTabVM = {
  periodLabel: '—',
  kpis: { recebidos: 0, fechados: 0, convRate: 0, pipeline: 0, avgTicket: 0, closedValue: 0 },
  convReuniao: 0, reuniaoBase: 0, fechouBase: 0,
  funnel: ALL_COLUMNS.map(c => ({ key: c.key, count: 0, value: 0 })), maxCount: 1,
  stageValues: [], maxStageValue: 1,
  bySeller: [], maxSellerValue: 1,
  snapshot: { total: 0, ativos: 0, fechados: 0 },
  temperature: { hot: 0, warm: 0, cold: 0 },
}

export async function getCommercialMetricsTab(context: RequestContext, mode: Mode): Promise<CommercialMetricsTabVM> {
  const teamId = context.activeTeamId
  if (!teamId) return { ...EMPTY_METRICS_TAB, periodLabel: rangeFor(mode).label }

  const range = rangeFor(mode)
  const [raw, milestones, revenue] = await Promise.all([
    getCommercialRaw(teamId),
    getLeadMilestonesForMetrics(),
    getClientRevenueForMetrics(),
  ])

  const allLeads = raw.leads
  // Clientes existentes adicionados ao funil (origem='cliente_existente') NÃO entram nas métricas de período.
  const leads = allLeads.filter(l => l.origem !== 'cliente_existente')

  const s = range.start.getTime(), e = range.end.getTime()
  const inRange = (iso: string | null): boolean => { if (!iso) return false; const time = new Date(iso).getTime(); return time >= s && time <= e }
  const startYMD = ymd(range.start), endYMD = ymd(range.end)
  const dayChegada = (l: (typeof leads)[number]): string => (l.received_at ?? l.created_at ?? '').slice(0, 10)

  // ---- KPIs do PERÍODO (received_at civil + lead_milestones) ----
  const recebidosLeads = leads.filter(l => { const d = dayChegada(l); return d >= startYMD && d <= endYMD })
  const recebidos = recebidosLeads.length
  const pipeline = recebidosLeads.filter(l => !isTerminal(l.status)).reduce((acc, l) => acc + (l.value || 0), 0)

  const ms = milestones.filter(x => inRange(x.achieved_on))
  const fechouIds = new Set(ms.filter(x => x.marco === 'fechou').map(x => x.lead_id))
  const reuniaoIds = new Set(ms.filter(x => x.marco === 'reuniao').map(x => x.lead_id))
  const fechados = fechouIds.size
  const closedValue = leads.filter(l => fechouIds.has(l.id)).reduce((acc, l) => acc + (l.value || 0), 0)
  const avgTicket = fechados > 0 ? closedValue / fechados : 0
  const convRate = recebidos > 0 ? fechados / recebidos : 0
  const convReuniao = reuniaoIds.size > 0 ? fechouIds.size / reuniaoIds.size : 0

  // ---- Estado ATUAL do funil (snapshot, sem período; usa TODOS os leads p/ bater com a aba Funil) ----
  const total = allLeads.length
  const ativos = allLeads.filter(l => !isTerminal(l.status)).length
  const fechadosTotal = allLeads.filter(l => l.status === 'fechado').length
  const hot = allLeads.filter(l => (l.score ?? 0) > 650).length
  const warm = allLeads.filter(l => (l.score ?? 0) > 400 && (l.score ?? 0) <= 650).length
  const cold = allLeads.filter(l => (l.score ?? 0) <= 400).length
  // Agrupa leads por status UMA vez (fix N+1: O(colunas × leads) → O(leads)).
  const leadsByStatus = new Map<string, typeof allLeads>()
  for (const l of allLeads) { const k = l.status ?? ''; const arr = leadsByStatus.get(k); if (arr) arr.push(l); else leadsByStatus.set(k, [l]) }
  const funnel = ALL_COLUMNS.map(col => {
    const ls = leadsByStatus.get(col.key) ?? []
    return { key: col.key, count: ls.length, value: ls.reduce((acc, l) => acc + (l.value || 0), 0) }
  })
  const maxCount = Math.max(...funnel.map(x => x.count), 1)
  const stageValues = funnel.filter(x => x.count > 0)
  const maxStageValue = Math.max(...stageValues.map(x => x.value), 1)

  // ---- Receita por vendedor (período, por paid_on; agrupa por clients.assigned_name) ----
  const sellerOf = new Map<string, string>(revenue.clients.map(c => [c.id, c.assigned_name || 'Sem responsável']))
  const agg: Record<string, { name: string; value: number; clients: Set<string> }> = {}
  for (const p of revenue.payments) {
    if (p.anulado) continue
    const d = (p.paid_on ?? '').slice(0, 10)
    if (d < startYMD || d > endYMD) continue
    const name = sellerOf.get(p.client_id) ?? 'Sem responsável'
    if (!agg[name]) agg[name] = { name, value: 0, clients: new Set() }
    agg[name].value += Number(p.valor_usd) || 0
    agg[name].clients.add(p.client_id)
  }
  const bySeller = Object.values(agg).map(x => ({ name: x.name, value: x.value, count: x.clients.size })).sort((a, b) => b.value - a.value)
  const maxSellerValue = Math.max(...bySeller.map(x => x.value), 1)

  return {
    periodLabel: range.label,
    kpis: { recebidos, fechados, convRate, pipeline, avgTicket, closedValue },
    convReuniao, reuniaoBase: reuniaoIds.size, fechouBase: fechouIds.size,
    funnel, maxCount, stageValues, maxStageValue,
    bySeller, maxSellerValue,
    snapshot: { total, ativos, fechados: fechadosTotal },
    temperature: { hot, warm, cold },
  }
}
