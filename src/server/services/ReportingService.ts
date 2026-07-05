import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialReport, ConversionStep, PipelineMovement, ReportInsight, ReportKpis, ReportPeriod, StageRanking } from '@/core/reporting/types'
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

export async function buildCommercialReport(context: RequestContext, period: ReportPeriod): Promise<CommercialReport> {
  const empty: CommercialReport = {
    period,
    kpis: { totalLeads: 0, newLeads: 0, meetingsScheduled: 0, meetingsHeld: 0, noShow: 0, proposals: 0, proposalsInReview: 0, won: 0, lost: 0, conversionRate: 0, avgCycleDays: 0, avgTicket: 0, totalValue: 0 },
    movements: [], conversions: [], funnel: [], stuckLeads: 0, insights: [],
  }
  const teamId = context.activeTeamId
  if (!teamId) return empty

  const [raw, stages] = await Promise.all([getCommercialRaw(teamId), getStages()])
  const stageName = (slug: string | null): string => (slug ? stages.find(s => s.slug === slug)?.nome ?? slug : '—')
  const wonSlugs = new Set(stages.filter(s => s.is_won).map(s => s.slug))
  const lostSlugs = new Set(stages.filter(s => s.is_lost).map(s => s.slug))
  const proposalSlugs = new Set(stages.filter(s => /propost/i.test(s.slug) || /propost/i.test(s.nome)).map(s => s.slug))
  const reuniaoSlugs = new Set(stages.filter(s => s.conta_reuniao || /reuni/i.test(s.nome)).map(s => s.slug))
  const noShowSlugs = new Set(stages.filter(s => /no.?show/i.test(s.slug) || /no.?show/i.test(s.nome)).map(s => s.slug))

  // Eventos no PERÍODO — cada MOVIMENTAÇÃO conta (nunca substitui a anterior).
  const events = raw.stageEvents.filter(e => inPeriod(e.changed_at, period))
  const dealsP = raw.deals.filter(d => inPeriod(d.data_fechamento ?? d.created_at, period))
  // Reunião entra no período pela data REAL (met_on), não por quando a linha nasceu — senão reunião histórica
  // (met_on retroativo, created_at = agora) cairia no mês errado (CLIENT-HISTORY-ADMIN-003).
  const meetingsP = raw.meetings.filter(m => inPeriod(m.met_on ?? m.created_at, period))
  const to = (set: Set<string>): number => events.filter(e => set.has(e.to_stage)).length

  const won = dealsP.length
  const lost = to(lostSlugs)
  const newLeads = raw.leads.filter(l => inPeriod(l.received_at ?? l.created_at, period)).length
  const kpis: ReportKpis = {
    totalLeads: raw.leads.length,
    newLeads,
    meetingsScheduled: to(reuniaoSlugs), // reunião MARCADA = movimentação para etapa de reunião (no período)
    meetingsHeld: meetingsP.length,      // reunião registrada (meetings) no período
    noShow: to(noShowSlugs),
    proposals: to(proposalSlugs),
    proposalsInReview: raw.leads.filter(l => l.status && proposalSlugs.has(l.status)).length,
    won,
    lost,
    conversionRate: rate(won, newLeads || raw.leads.length),
    avgCycleDays: won > 0 ? Math.round(sum(dealsP.map(d => {
      const lead = raw.leads.find(l => l.id === d.lead_id)
      const start = lead?.received_at ?? lead?.created_at ?? null
      return start && d.data_fechamento ? Math.max(0, (new Date(d.data_fechamento).getTime() - new Date(start).getTime()) / DAY) : 0
    })) / won) : 0,
    avgTicket: won > 0 ? Math.round(sum(dealsP.map(d => num(d.valor_total_usd))) / won) : 0,
    totalValue: Math.round(sum(dealsP.map(d => num(d.valor_total_usd)))),
  }

  // Movimentações (from → to) no período.
  const moveMap = new Map<string, PipelineMovement>()
  for (const e of events) {
    const key = `${e.from_stage ?? ''}→${e.to_stage}`
    const cur = moveMap.get(key) ?? { from: e.from_stage ? stageName(e.from_stage) : null, to: stageName(e.to_stage), count: 0 }
    cur.count += 1
    moveMap.set(key, cur)
  }
  const movements = Array.from(moveMap.values()).sort((a, b) => b.count - a.count)

  // Conversões (por alcance de etapa no período).
  const conversions: ConversionStep[] = [
    { label: 'Lead → Contato', rate: rate(events.filter(e => reuniaoSlugs.has(e.to_stage) || proposalSlugs.has(e.to_stage)).length + kpis.meetingsHeld, kpis.totalLeads) },
    { label: 'Contato → Reunião', rate: rate(kpis.meetingsScheduled, kpis.totalLeads) },
    { label: 'Reunião → Proposta', rate: rate(kpis.proposals, Math.max(1, kpis.meetingsScheduled)) },
    { label: 'Proposta → Fechado', rate: rate(won, Math.max(1, kpis.proposals)) },
  ]

  // Ranking/gargalos por fase (leads atualmente parados em cada etapa).
  const funnel: StageRanking[] = stages
    .filter(s => !s.is_won && !s.is_lost)
    .map(s => {
      const leadsHere = raw.leads.filter(l => l.status === s.slug)
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

  return { period, kpis, movements, conversions, funnel, stuckLeads, insights }
}
