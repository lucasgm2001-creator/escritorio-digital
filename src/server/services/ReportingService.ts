import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialReport, ConversionStep, PeriodFunnelStep, PipelineMovement, ReportComparison, ReportInsight, ReportKpis, ReportPeriod, StageRanking } from '@/core/reporting/types'
import { getCommercialRaw } from '@/server/repositories/CommercialMetricsRepository'
import { getStages } from '@/lib/funnelStages.server'

// ÚNICO lugar que monta o relatório comercial (Constituição: o PDF nunca calcula — consome isto).
// Mesma fonte do Dashboard (CommercialMetricsRepository) — zero duplicação. Team-scoped (TEAM-001).

const DAY = 86_400_000
const num = (v: number | null): number => Number(v ?? 0)
const inPeriod = (iso: string | null, p: ReportPeriod): boolean => {
  if (!iso) return false
  // Comparação NUMÉRICA (data pura → meio-dia local p/ não escorregar de dia por fuso). Cada movimentação
  // é avaliada pela sua data; nada é substituído — reunião marcada continua contando mesmo virando no-show.
  const ms = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso).getTime()
  return ms >= new Date(p.from).getTime() && ms <= new Date(p.to).getTime()
}
const daysSince = (iso: string | null): number => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0)
const sum = (list: number[]): number => list.reduce((a, b) => a + b, 0)
const rate = (a: number, b: number): number => (b > 0 ? a / b : 0)

export async function buildCommercialReport(context: RequestContext, period: ReportPeriod, prevPeriod?: ReportPeriod): Promise<CommercialReport> {
  const empty: CommercialReport = {
    period,
    kpis: { totalLeads: 0, newLeads: 0, interagiram: 0, meetingsScheduled: 0, meetingsHeld: 0, noShow: 0, proposals: 0, proposalsInReview: 0, won: 0, lost: 0, conversionRate: 0, avgCycleDays: 0, avgTicket: 0, totalValue: 0, naoInteragiram: 0, negociosFuturos: 0, reagendamentos: 0 },
    cumulativeFunnel: [], comparison: null, movements: [], conversions: [], funnel: [], stuckLeads: 0, insights: [],
  }
  const teamId = context.activeTeamId
  if (!teamId) return empty

  const [raw, stages] = await Promise.all([getCommercialRaw(teamId, { withPipeline: true }), getStages()])
  const stageName = (slug: string | null): string => (slug ? stages.find(s => s.slug === slug)?.nome ?? slug : '—')
  const wonSlugs = new Set(stages.filter(s => s.is_won).map(s => s.slug))
  const lostSlugs = new Set(stages.filter(s => s.is_lost).map(s => s.slug))
  // Cada métrica operacional aponta para a sua etapa específica. Não inferimos etapas anteriores: uma
  // renovação, um upgrade ou uma mudança lateral nunca pode virar uma venda/reunião no relatório.
  const namedSlugs = (fallback: string, predicate: (slug: string, nome: string) => boolean): Set<string> => {
    const found = stages.filter(s => predicate(s.slug, s.nome)).map(s => s.slug)
    return new Set(found.length > 0 ? found : [fallback])
  }
  const interagiuSlugs = namedSlugs('interagiu', (slug, nome) => slug === 'interagiu' || /^interagiu$/i.test(nome.trim()))
  const reuniaoSlugs = namedSlugs('reuniao', (slug, nome) => slug === 'reuniao' || /^reuni[ãa]o agendada$/i.test(nome.trim()))
  const proposalSlugs = namedSlugs('proposta', (slug, nome) => slug === 'proposta' || /^proposta em an[aá]lise$/i.test(nome.trim()))
  const naoInteragiuSlugs = namedSlugs('nao_interagiu', (slug, nome) => slug === 'nao_interagiu' || /^n[aã]o interagiu$/i.test(nome.trim()))
  const noShowSlugs = new Set(stages.filter(s => /no.?show/i.test(s.slug) || /no.?show/i.test(s.nome)).map(s => s.slug))
  const reagendamentoSlugs = new Set(stages.filter(s => /reagend/i.test(s.slug) || /reagend/i.test(s.nome)).map(s => s.slug))
  const negocioFuturoSlugs = new Set(stages.filter(s => /negocio.?futuro/i.test(s.slug) || /futuro/i.test(s.nome)).map(s => s.slug))
  // Uma mesma pessoa pode ter várias mudanças na semana, mas cada métrica representa pessoas, não cliques.
  const leadIdsFor = (events: typeof raw.stageEvents, matches: (event: typeof raw.stageEvents[number]) => boolean): Set<string> =>
    new Set(events.filter(e => !!e.lead_id && matches(e)).map(e => e.lead_id as string))

  // Métricas de movimentação: venda só existe quando a transição foi Proposta → etapa vencedora.
  // Registros de deals são financeiros/comerciais auxiliares e não definem o funil.
  const periodFunnel = (win: ReportPeriod) => {
    const evs = raw.stageEvents.filter(e => inPeriod(e.changed_at, win))
    const wonLeadIds = leadIdsFor(evs, e => proposalSlugs.has(e.from_stage ?? '') && wonSlugs.has(e.to_stage))
    return {
      newLeads: raw.leads.filter(l => inPeriod(l.received_at, win)).length,
      interagiram: leadIdsFor(evs, e => interagiuSlugs.has(e.to_stage)),
      reunioes: leadIdsFor(evs, e => reuniaoSlugs.has(e.to_stage)),
      meetingsHeld: leadIdsFor(evs, e => reuniaoSlugs.has(e.from_stage ?? '') && proposalSlugs.has(e.to_stage)),
      propostas: leadIdsFor(evs, e => proposalSlugs.has(e.to_stage)),
      won: wonLeadIds,
      noShow: leadIdsFor(evs, e => noShowSlugs.has(e.to_stage)),
      lost: leadIdsFor(evs, e => lostSlugs.has(e.to_stage)),
      naoInteragiu: leadIdsFor(evs, e => naoInteragiuSlugs.has(e.to_stage)),
      negociosFuturos: leadIdsFor(evs, e => negocioFuturoSlugs.has(e.to_stage)),
      reagendamentos: leadIdsFor(evs, e => reagendamentoSlugs.has(e.to_stage)),
    }
  }
  const cur = periodFunnel(period)
  const prev = prevPeriod ? periodFunnel(prevPeriod) : null

  const events = raw.stageEvents.filter(e => inPeriod(e.changed_at, period))
  // Valores só são associados a vendas válidas do funil. Renovação, upgrade, anulação e qualquer deal sem
  // Proposta → Venda ficam fora de "valor fechado", ticket e ciclo comercial.
  const dealsP = raw.deals.filter(d =>
    inPeriod(d.data_fechamento, period)
    && cur.won.has(d.lead_id ?? '')
    && (!d.kind || d.kind === 'sale')
    && d.status !== 'interrompido'
    && d.status !== 'anulado'
  )

  // "Não interagiram" é a única métrica de coorte: lead que entrou e ainda não teve nenhuma movimentação.
  const movedLeadIds = new Set(events.map(e => e.lead_id).filter(Boolean))
  const naoInteragiram = raw.leads.filter(l => inPeriod(l.received_at, period) && !movedLeadIds.has(l.id)).length

  const kpis: ReportKpis = {
    totalLeads: raw.leads.length,
    newLeads: cur.newLeads,
    interagiram: cur.interagiram.size,
    meetingsScheduled: cur.reunioes.size,
    meetingsHeld: cur.meetingsHeld.size,
    noShow: cur.noShow.size,
    proposals: cur.propostas.size,
    proposalsInReview: cur.propostas.size,
    won: cur.won.size,
    lost: cur.lost.size,
    conversionRate: rate(cur.won.size, cur.newLeads),
    avgCycleDays: dealsP.length > 0 ? Math.round(sum(dealsP.map(d => {
      const lead = raw.leads.find(l => l.id === d.lead_id)
      const start = lead?.received_at ?? lead?.created_at ?? null
      return start && d.data_fechamento ? Math.max(0, (new Date(d.data_fechamento).getTime() - new Date(start).getTime()) / DAY) : 0
    })) / dealsP.length) : 0,
    avgTicket: dealsP.length > 0 ? Math.round(sum(dealsP.map(d => num(d.valor_total_usd))) / dealsP.length) : 0,
    totalValue: Math.round(sum(dealsP.map(d => num(d.valor_total_usd)))),
    naoInteragiram, negociosFuturos: cur.negociosFuturos.size, reagendamentos: cur.reagendamentos.size,
  }

  // Funil de movimentações reais no período + comparativo equivalente.
  const cumulativeFunnel: PeriodFunnelStep[] = [
    { key: 'leads', label: 'Leads recebidos', count: cur.newLeads },
    { key: 'interagiram', label: 'Interagiram', count: cur.interagiram.size },
    { key: 'reunioes', label: 'Reuniões marcadas', count: cur.reunioes.size },
    { key: 'propostas', label: 'Propostas em análise', count: cur.propostas.size },
    { key: 'vendas', label: 'Vendas concluídas', count: cur.won.size },
  ]
  const comparison: ReportComparison | null = prev && prevPeriod
    ? { newLeads: prev.newLeads, interagiram: prev.interagiram.size, meetingsScheduled: prev.reunioes.size, meetingsHeld: prev.meetingsHeld.size, proposals: prev.propostas.size, won: prev.won.size, conversionRate: rate(prev.won.size, prev.newLeads) }
    : null

  // Movimentações (from → to) no período.
  const moveMap = new Map<string, PipelineMovement>()
  for (const e of events) {
    const key = `${e.from_stage ?? ''}→${e.to_stage}`
    const mv = moveMap.get(key) ?? { from: e.from_stage ? stageName(e.from_stage) : null, to: stageName(e.to_stage), count: 0 }
    mv.count += 1
    moveMap.set(key, mv)
  }
  const movements = Array.from(moveMap.values()).sort((a, b) => b.count - a.count)

  // Conversões entre movimentos reais do funil no período.
  const conversions: ConversionStep[] = [
    { label: 'Lead → Contato', rate: rate(kpis.interagiram, kpis.newLeads) },
    { label: 'Contato → Reunião', rate: rate(kpis.meetingsScheduled, kpis.interagiram) },
    { label: 'Reunião → Proposta', rate: rate(kpis.meetingsHeld, kpis.meetingsScheduled) },
    { label: 'Proposta → Fechado', rate: rate(kpis.won, kpis.proposals) },
  ]

  // Ranking/gargalos por fase (leads atualmente parados em cada etapa). Agrupa por status UMA vez
  // (fix N+1: O(etapas × leads) → O(leads)).
  const leadsByStatus = new Map<string, typeof raw.leads>()
  for (const l of raw.leads) { const k = l.status ?? ''; const arr = leadsByStatus.get(k); if (arr) arr.push(l); else leadsByStatus.set(k, [l]) }
  const funnel: StageRanking[] = stages
    .filter(s => !s.is_won && !s.is_lost)
    .map(s => {
      const leadsHere = leadsByStatus.get(s.slug) ?? []
      return {
        stage: s.nome,
        count: leadsHere.length,
        avgDays: leadsHere.length > 0 ? Math.round(sum(leadsHere.map(l => daysSince(l.stage_changed_at ?? l.created_at))) / leadsHere.length) : null,
      }
    })
    .sort((a, b) => b.count - a.count)

  const stuckLeads = raw.leads.filter(l => l.status && !wonSlugs.has(l.status) && !lostSlugs.has(l.status) && daysSince(l.stage_changed_at ?? l.created_at) > 7).length

  // Insights automáticos (sem IA) — derivados das métricas.
  const insights: ReportInsight[] = []
  const gargalo = funnel[0]
  if (gargalo && gargalo.count > 0) insights.push({ kind: 'gargalo', message: `Maior gargalo: ${gargalo.stage} (${gargalo.count} leads, ${gargalo.avgDays ?? 0}d em média).` })
  if (kpis.meetingsScheduled > 0 && kpis.noShow / kpis.meetingsScheduled >= 0.3) insights.push({ kind: 'no_show', message: `No-show alto: ${Math.round((kpis.noShow / kpis.meetingsScheduled) * 100)}% das reuniões marcadas.` })
  if (kpis.conversionRate < 0.1 && kpis.totalLeads >= 10) insights.push({ kind: 'queda_conversao', message: `Conversão baixa: ${Math.round(kpis.conversionRate * 100)}%.` })
  const best = funnel.filter(f => f.count > 0).sort((a, b) => (a.avgDays ?? 0) - (b.avgDays ?? 0))[0]
  if (best) insights.push({ kind: 'melhor_etapa', message: `Etapa mais fluida: ${best.stage} (${best.avgDays ?? 0}d em média).` })
  if (stuckLeads > 0) insights.push({ kind: 'pior_etapa', message: `${stuckLeads} leads parados há mais de 7 dias.` })

  return { period, kpis, cumulativeFunnel, comparison, movements, conversions, funnel, stuckLeads, insights }
}
