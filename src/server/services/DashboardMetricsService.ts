import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CommercialDashboardVM } from '@/core/metrics/types'
import { getCommercialRaw } from '@/server/repositories/CommercialMetricsRepository'
import { getStages } from '@/lib/funnelStages.server'
import { meetingCommissionCounts } from '@/lib/commission/constants'

// Fonte ÚNICA de KPIs do Dashboard Executivo (ARCH-001). Nenhuma tela calcula — tudo sai daqui.
// Definições explícitas por KPI (a partir das tabelas canônicas), team-scoped (TEAM-001).

const DAY = 86_400_000
const num = (v: number | null): number => Number(v ?? 0)
const daysSince = (iso: string | null): number => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0)
const sum = (list: number[]): number => list.reduce((a, b) => a + b, 0)

const EMPTY: CommercialDashboardVM = {
  leadsActive: 0, leadsNew: 0, leadsStuck: 0, avgDaysAsLead: 0, avgDaysPerStage: 0,
  meetings: 0, noShows: 0, proposals: 0, closes: 0, conversionRate: 0, avgTicket: 0,
  pipelineValue: 0, revenueForecast: 0, revenueRealized: 0, revenueLost: 0,
}

export async function getCommercialDashboard(context: RequestContext): Promise<CommercialDashboardVM> {
  const teamId = context.activeTeamId
  if (!teamId) return EMPTY

  const [raw, stages] = await Promise.all([getCommercialRaw(teamId), getStages()])

  const wonSlugs = new Set(stages.filter(s => s.is_won).map(s => s.slug))
  const lostSlugs = new Set(stages.filter(s => s.is_lost).map(s => s.slug))
  const proposalSlugs = new Set(stages.filter(s => /propost/i.test(s.slug) || /propost/i.test(s.nome)).map(s => s.slug))
  const noShowSlugs = new Set(stages.filter(s => /no.?show/i.test(s.slug) || /no.?show/i.test(s.nome)).map(s => s.slug))

  const isActive = (status: string | null): boolean => !!status && !wonSlugs.has(status) && !lostSlugs.has(status)
  const activeLeads = raw.leads.filter(l => isActive(l.status))
  const lostLeads = raw.leads.filter(l => l.status && lostSlugs.has(l.status))

  // tempo médio por fase: gaps entre movimentações consecutivas do MESMO lead.
  const byLead = new Map<string, number[]>()
  for (const e of raw.stageEvents) {
    if (!e.lead_id) continue
    const arr = byLead.get(e.lead_id) ?? []
    arr.push(new Date(e.changed_at).getTime())
    byLead.set(e.lead_id, arr)
  }
  let gapSum = 0, gapCount = 0
  for (const times of Array.from(byLead.values())) {
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) { gapSum += times[i] - times[i - 1]; gapCount++ }
  }

  const closes = raw.deals.length
  const totalLeads = raw.leads.length

  return {
    leadsActive: activeLeads.length,
    leadsNew: raw.leads.filter(l => daysSince(l.received_at ?? l.created_at) <= 7).length,
    leadsStuck: activeLeads.filter(l => daysSince(l.stage_changed_at ?? l.created_at) > 7).length,
    avgDaysAsLead: totalLeads > 0 ? Math.round(sum(raw.leads.map(l => daysSince(l.received_at ?? l.created_at))) / totalLeads) : 0,
    avgDaysPerStage: gapCount > 0 ? Math.round(gapSum / gapCount / DAY) : 0,
    // Reuniões que contam como comissão (Parte 6): a partir de JUL/2026 não entram no Dashboard.
    meetings: raw.meetings.filter(m => meetingCommissionCounts(m.met_on ?? m.created_at)).length,
    noShows: raw.stageEvents.filter(e => noShowSlugs.has(e.to_stage)).length,
    proposals: raw.stageEvents.filter(e => proposalSlugs.has(e.to_stage)).length,
    closes,
    conversionRate: totalLeads > 0 ? closes / totalLeads : 0,
    avgTicket: closes > 0 ? Math.round(sum(raw.deals.map(d => num(d.valor_total_usd))) / closes) : 0,
    pipelineValue: Math.round(sum(activeLeads.map(l => num(l.value)))),
    revenueForecast: Math.round(sum(activeLeads.map(l => num(l.value)))),
    revenueRealized: Math.round(sum(raw.deals.map(d => num(d.valor_total_usd)))),
    revenueLost: Math.round(sum(lostLeads.map(l => num(l.value)))),
  }
}
