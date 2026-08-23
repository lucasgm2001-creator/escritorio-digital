import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialMetricsTabVM } from '@/core/metrics/types'
import {
  getCommercialRaw, getLeadMilestonesForMetrics, getClientRevenueForMetrics,
} from '@/server/repositories/CommercialMetricsRepository'
import { rangeFor, type Range, type Mode } from '@/lib/period'
import { getStages } from '@/lib/funnelStages.server'
import { interagiuSlugs, reuniaoSlugs, propostaSlugs } from '@/lib/funnelStages'
import { ymd } from '@/lib/date'
import { funnelConversionPct } from '@/lib/funnelMetrics'
import { closedValue, closedCount, averageTicket } from '@/core/metrics/sales'
import { receivedRevenueBySeller, type PaymentRowWithClient } from '@/core/metrics/revenue'
import { ALL_COLUMNS } from '@/app/(dashboard)/comercial/types'

// KPIs da aba Métricas (CRM-RC-002 → SPRINT-FINAL-001). Conversão/Ticket/Valor Fechado/Receita-por-vendedor
// vêm dos MESMOS primitivos do Hall/Dashboard/Financeiro (funnelConversionPct + core/metrics sales/revenue) —
// FONTE ÚNICA, sem definição própria. Funil/temperatura/pipeline/reunião→venda seguem por lead/marco (detalhe
// operacional da aba). Período via rangeFor(mode); team-scoped (ARCH-001/TEAM-001). Nada é recalculado na tela.
const isTerminal = (s: string | null): boolean => s === 'fechado' || s === 'perdido' || s === 'lixeira'

export const EMPTY_METRICS_TAB: CommercialMetricsTabVM = {
  periodLabel: '—',
  kpis: { recebidos: 0, fechados: 0, conversao: 0, pipeline: 0, avgTicket: 0, closedValue: 0 },
  convReuniao: 0, reuniaoBase: 0, fechouBase: 0,
  acoes: { recebidos: 0, trabalhados: 0, reunioesMarcadas: 0, reunioesRealizadas: 0, propostas: 0, vendas: 0 },
  taxas: { interacao: null, marcadaRealizada: null, reuniaoVenda: null, conversao: null },
  funnel: ALL_COLUMNS.map(c => ({ key: c.key, count: 0, value: 0 })), maxCount: 1,
  stageValues: [], maxStageValue: 1,
  bySeller: [], maxSellerValue: 1,
  snapshot: { total: 0, ativos: 0, fechados: 0 },
  temperature: { hot: 0, warm: 0, cold: 0 },
}

// `window` (PERIODO-NAV-001): a aba passou a navegar no tempo — mês anterior, trimestre passado, janela
// personalizada. Sem ela o serviço só sabia montar o período CORRENTE (rangeFor(mode) sempre a partir de
// hoje). Quando vem preenchida, é a autoridade; o `mode` continua valendo para o caminho antigo.
export async function getCommercialMetricsTab(
  context: RequestContext, mode: Mode, window?: { fromYMD: string; toYMD: string; label: string },
): Promise<CommercialMetricsTabVM> {
  const janela = (): Range => window
    ? { mode: 'custom', start: new Date(`${window.fromYMD}T00:00:00`), end: new Date(`${window.toYMD}T23:59:59.999`), label: window.label }
    : rangeFor(mode)
  const teamId = context.activeTeamId
  if (!teamId) return { ...EMPTY_METRICS_TAB, periodLabel: janela().label }

  const range = janela()
  // withPipeline: precisamos de stage_events para as AÇÕES do período (reunião realizada, proposta), que
  // são transições de funil e não existem em lead_milestones. É uma tabela pequena e a aba é sob demanda.
  const [raw, milestones, revenue, stages] = await Promise.all([
    getCommercialRaw(teamId, { withPipeline: true }),
    getLeadMilestonesForMetrics(),
    getClientRevenueForMetrics(),
    getStages(),
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

  // Reunião→Venda continua por marco (lead_milestones) — métrica de FUNIL, distinta e rotulada à parte.
  const ms = milestones.filter(x => inRange(x.achieved_on))
  const fechouIds = new Set(ms.filter(x => x.marco === 'fechou').map(x => x.lead_id))
  const reuniaoIds = new Set(ms.filter(x => x.marco === 'reuniao').map(x => x.lead_id))
  const convReuniao = reuniaoIds.size > 0 ? fechouIds.size / reuniaoIds.size : 0

  // FONTE ÚNICA (idêntico a Hall/Dashboard/Financeiro/PDF): Valor Fechado/Ticket = deals; Conversão =
  // funnelConversionPct dos leads que CHEGARAM no período (received_at). A aba não recalcula nada próprio.
  const periodLeadsStrict = allLeads.filter(l => { const d = (l.received_at ?? '').slice(0, 10); return !!d && d >= startYMD && d <= endYMD })
  const valorFechado = closedValue(raw.deals, startYMD, endYMD)
  const fechados = closedCount(raw.deals, startYMD, endYMD)
  const avgTicket = averageTicket(valorFechado, fechados)
  const conversao = funnelConversionPct(periodLeadsStrict)

  // ---- AÇÕES REALIZADAS no período (METRICAS-ACOES-001) ----
  // Contagem de LEADS DISTINTOS, não de cliques: a mesma pessoa movida duas vezes na semana é uma ação.
  // As fases são resolvidas por slug OU nome (lib/funnelStages) — a equipe pode renomear a coluna.
  const sInteragiu = interagiuSlugs(stages), sReuniao = reuniaoSlugs(stages), sProposta = propostaSlugs(stages)
  const evs = raw.stageEvents.filter(ev => inRange(ev.changed_at))
  const distinctLeads = (match: (ev: (typeof evs)[number]) => boolean): number =>
    new Set(evs.filter(ev => !!ev.lead_id && match(ev)).map(ev => ev.lead_id as string)).size

  const trabalhados = new Set([
    ...ms.filter(x => x.marco === 'interagiu').map(x => x.lead_id),
    ...evs.filter(ev => ev.lead_id && sInteragiu.has(ev.to_stage)).map(ev => ev.lead_id as string),
  ]).size
  const reunioesMarcadas = new Set([
    ...reuniaoIds,
    ...evs.filter(ev => ev.lead_id && sReuniao.has(ev.to_stage)).map(ev => ev.lead_id as string),
  ]).size
  // "Realizada" = saiu de Reunião Agendada para Proposta em Análise. MESMA definição do relatório.
  const reunioesRealizadas = distinctLeads(ev => sReuniao.has(ev.from_stage ?? '') && sProposta.has(ev.to_stage))
  const propostas = distinctLeads(ev => sProposta.has(ev.to_stage))

  const acoes = { recebidos, trabalhados, reunioesMarcadas, reunioesRealizadas, propostas, vendas: fechados }
  // Denominador zero → null (a UI mostra "—"): sem base, 0% seria mentira.
  const taxa = (num: number, den: number): number | null => (den > 0 ? num / den : null)
  const taxas = {
    interacao: taxa(trabalhados, recebidos),
    marcadaRealizada: taxa(reunioesRealizadas, reunioesMarcadas),
    reuniaoVenda: taxa(fechados, reunioesRealizadas),
    conversao: taxa(fechados, recebidos),
  }

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

  // ---- Receita por vendedor (período) — FONTE ÚNICA (mesmo primitivo do Financeiro/Dashboard/PDF) ----
  const sellerOf = new Map<string, string>(revenue.clients.map(c => [c.id, c.assigned_name || 'Sem responsável']))
  const bySeller = receivedRevenueBySeller(revenue.payments as PaymentRowWithClient[], sellerOf, startYMD, endYMD)
  const maxSellerValue = Math.max(...bySeller.map(x => x.value), 1)

  return {
    periodLabel: range.label,
    acoes, taxas,
    kpis: { recebidos, fechados, conversao, pipeline, avgTicket, closedValue: valorFechado },
    convReuniao, reuniaoBase: reuniaoIds.size, fechouBase: fechouIds.size,
    funnel, maxCount, stageValues, maxStageValue,
    bySeller, maxSellerValue,
    snapshot: { total, ativos, fechados: fechadosTotal },
    temperature: { hot, warm, cold },
  }
}
