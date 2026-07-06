import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialReport, ConversionStep, PeriodFunnelStep, PipelineMovement, ReportComparison, ReportInsight, ReportKpis, ReportPeriod, StageRanking } from '@/core/reporting/types'
import { getCommercialRaw } from '@/server/repositories/CommercialMetricsRepository'
import { getStages } from '@/lib/funnelStages.server'
import { meetingCommissionCounts } from '@/lib/commission/constants'

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
  const proposalSlugs = new Set(stages.filter(s => /propost/i.test(s.slug) || /propost/i.test(s.nome)).map(s => s.slug))
  // reuniaoSlugs inclui proposta+fechado (conta_reuniao=true) → "visitou reunião" já cobre quem pulou direto p/ proposta/venda.
  const reuniaoSlugs = new Set(stages.filter(s => s.conta_reuniao || /reuni/i.test(s.nome)).map(s => s.slug))
  const noShowSlugs = new Set(stages.filter(s => /no.?show/i.test(s.slug) || /no.?show/i.test(s.nome)).map(s => s.slug))
  const reagendamentoSlugs = new Set(stages.filter(s => /reagend/i.test(s.slug) || /reagend/i.test(s.nome)).map(s => s.slug))
  const negocioFuturoSlugs = new Set(stages.filter(s => /negocio.?futuro/i.test(s.slug) || /futuro/i.test(s.nome)).map(s => s.slug))
  // Alcance por CONJUNTO de etapas visitadas — NÃO por posição (posições 6/7/9/10/11 não são "mais fundo" no funil,
  // são estados laterais/terminais; um lead perdido cedo não pode contar como reunião/proposta).
  const hits = (visited: Set<string>, target: Set<string>): boolean => Array.from(visited).some(s => target.has(s))

  // ── Funil ACUMULATIVO de uma janela (Parte 3): por lead, o CONJUNTO de etapas visitadas na janela conta em
  //    TODAS as etapas logicamente anteriores (nunca substitui). Um lead que pulou Novo→Proposta conta em
  //    interagiram, reuniões E propostas. Fechar (deal) garante proposta+reunião mesmo sem evento na janela.
  const periodFunnel = (win: ReportPeriod) => {
    const evs = raw.stageEvents.filter(e => inPeriod(e.changed_at, win))
    const dealsW = raw.deals.filter(d => inPeriod(d.data_fechamento, win))   // ESTRITO: fechamento = data_fechamento
    const visited = new Map<string, Set<string>>()
    for (const e of evs) { if (!e.lead_id || !e.to_stage) continue; const set = visited.get(e.lead_id) ?? new Set<string>(); set.add(e.to_stage); visited.set(e.lead_id, set) }
    const wonLeadIds = new Set(dealsW.map(d => d.lead_id).filter(Boolean) as string[])
    const leadIds = new Set<string>(Array.from(visited.keys()).concat(Array.from(wonLeadIds)))  // fechar na janela também "interagiu"
    let reunioes = 0, propostas = 0
    Array.from(leadIds).forEach(id => {
      const v = visited.get(id) ?? new Set<string>()
      const won = wonLeadIds.has(id)
      if (won || hits(v, reuniaoSlugs)) reunioes++                            // venda/proposta ⊂ reuniaoSlugs
      if (won || hits(v, proposalSlugs) || hits(v, wonSlugs)) propostas++     // venda garante proposta
    })
    return {
      newLeads: raw.leads.filter(l => inPeriod(l.received_at, win)).length,   // ESTRITO: chegada = received_at
      interagiram: leadIds.size,                                             // avançou (ou fechou) na janela
      reunioes,                                                              // alcançou ≥ reunião (cumulativo)
      propostas,                                                             // alcançou ≥ proposta (cumulativo)
      won: dealsW.length,                                                    // vendas concluídas na janela
    }
  }
  const cur = periodFunnel(period)
  const prev = prevPeriod ? periodFunnel(prevPeriod) : null

  const events = raw.stageEvents.filter(e => inPeriod(e.changed_at, period))
  const dealsP = raw.deals.filter(d => inPeriod(d.data_fechamento, period))
  const meetingsP = raw.meetings.filter(m => inPeriod(m.met_on, period) && meetingCommissionCounts(m.met_on))
  const to = (set: Set<string>): number => events.filter(e => set.has(e.to_stage)).length

  // Secundárias do período (Parte 2) — como EVENTOS na janela (movimentações), exceto naoInteragiram (coorte de chegada).
  const movedLeadIds = new Set(events.map(e => e.lead_id).filter(Boolean))
  const naoInteragiram = raw.leads.filter(l => inPeriod(l.received_at, period) && !movedLeadIds.has(l.id)).length
  const negociosFuturos = to(negocioFuturoSlugs)   // movimentações para "Negócio Futuro" na janela
  const reagendamentos = to(reagendamentoSlugs)     // movimentações para "Reagendamento" na janela

  const kpis: ReportKpis = {
    totalLeads: raw.leads.length,
    newLeads: cur.newLeads,
    interagiram: cur.interagiram,
    meetingsScheduled: cur.reunioes,   // CUMULATIVO (alcançou ≥ reunião)
    meetingsHeld: meetingsP.length,    // reunião registrada (meetings) no período
    noShow: to(noShowSlugs),
    proposals: cur.propostas,          // CUMULATIVO (alcançou ≥ proposta)
    proposalsInReview: raw.leads.filter(l => l.status && proposalSlugs.has(l.status)).length,
    won: cur.won,
    lost: to(lostSlugs),
    conversionRate: rate(cur.won, cur.newLeads || raw.leads.length),
    avgCycleDays: cur.won > 0 ? Math.round(sum(dealsP.map(d => {
      const lead = raw.leads.find(l => l.id === d.lead_id)
      const start = lead?.received_at ?? lead?.created_at ?? null
      return start && d.data_fechamento ? Math.max(0, (new Date(d.data_fechamento).getTime() - new Date(start).getTime()) / DAY) : 0
    })) / cur.won) : 0,
    avgTicket: cur.won > 0 ? Math.round(sum(dealsP.map(d => num(d.valor_total_usd))) / cur.won) : 0,
    totalValue: Math.round(sum(dealsP.map(d => num(d.valor_total_usd)))),
    naoInteragiram, negociosFuturos, reagendamentos,
  }

  // Funil ACUMULATIVO (topo do relatório) + comparativo com o período anterior (mesma duração).
  const cumulativeFunnel: PeriodFunnelStep[] = [
    { key: 'leads', label: 'Leads recebidos', count: cur.newLeads },
    { key: 'interagiram', label: 'Interagiram', count: cur.interagiram },
    { key: 'reunioes', label: 'Reuniões marcadas', count: cur.reunioes },
    { key: 'propostas', label: 'Propostas em análise', count: cur.propostas },
    { key: 'vendas', label: 'Vendas concluídas', count: cur.won },
  ]
  const comparison: ReportComparison | null = prev
    ? { newLeads: prev.newLeads, interagiram: prev.interagiram, meetingsScheduled: prev.reunioes, proposals: prev.propostas, won: prev.won }
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

  // Conversões (por alcance de etapa no período).
  const conversions: ConversionStep[] = [
    { label: 'Lead → Contato', rate: rate(events.filter(e => reuniaoSlugs.has(e.to_stage) || proposalSlugs.has(e.to_stage)).length + kpis.meetingsHeld, kpis.totalLeads) },
    { label: 'Contato → Reunião', rate: rate(kpis.meetingsScheduled, kpis.totalLeads) },
    { label: 'Reunião → Proposta', rate: rate(kpis.proposals, Math.max(1, kpis.meetingsScheduled)) },
    { label: 'Proposta → Fechado', rate: rate(kpis.won, Math.max(1, kpis.proposals)) },
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
