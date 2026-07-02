import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { LeadHubVM, LeadPipelineStep, LeadStats, LeadTimelineItem } from '@/lib/commercial/lead-hub-types'
import { getLeadById } from '@/server/repositories/LeadRepository'
import * as Timeline from '@/server/repositories/LeadTimelineRepository'
import { getStages } from '@/lib/funnelStages.server'

// Regra de negócio do Hub do Lead (ARCH-001). Garante o isolamento de equipe (TEAM-001) verificando a
// posse do lead ANTES de carregar qualquer registro-filho, e COMPÕE o view-model (perfil + timeline
// universal + estatísticas + pipeline). A UI recebe pronto — nenhum join/regra vive na tela.

type LeadRow = {
  id: string
  team_id: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  value: number | null
  status: string | null
  assigned_name: string | null
  origem: string | null
  nicho: string | null
  notes: string | null
  created_at: string | null
  received_at: string | null
  stage_changed_at: string | null
  next_contact: string | null
}

const DAY = 86_400_000

function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY))
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY))
}

function byNewest(a: LeadTimelineItem, b: LeadTimelineItem): number {
  return new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime()
}

export async function getLeadHub(context: RequestContext, leadId: string): Promise<LeadHubVM | null> {
  const teamId = context.activeTeamId
  if (!teamId) return null

  const raw = await getLeadById(leadId)
  if (!raw) return null
  const lead = raw as unknown as LeadRow
  // ISOLAMENTO (TEAM-001): o lead precisa ser da equipe ativa. Só então carregamos os filhos por lead_id.
  if (lead.team_id !== teamId) return null

  const [interactions, stageEvents, meetings, deals, activities, stages] = await Promise.all([
    Timeline.getInteractions(leadId),
    Timeline.getStageEvents(leadId),
    Timeline.getMeetings(leadId),
    Timeline.getDeals(leadId),
    Timeline.getActivities(leadId),
    getStages(),
  ])

  const stageName = (slug: string | null): string => (slug ? stages.find(s => s.slug === slug)?.nome ?? slug : '—')
  const proposalSlugs = new Set(stages.filter(s => /propost/i.test(s.slug) || /propost/i.test(s.nome)).map(s => s.slug))

  // ---- Timeline universal (une todas as fontes em ordem cronológica) ----
  const timeline: LeadTimelineItem[] = [
    ...interactions.map(i => ({
      id: `int-${i.id}`,
      type: (i.type === 'nota' ? 'observacao' : 'atividade') as LeadTimelineItem['type'],
      author: i.created_by_name,
      at: i.created_at,
      title: i.type === 'nota' ? 'Observação' : 'Contato',
      description: i.note,
    })),
    ...stageEvents.map(e => ({
      id: `stg-${e.id}`,
      type: 'fase' as const,
      author: e.seller_name,
      at: e.changed_at,
      title: 'Mudança de fase',
      description: `${stageName(e.from_stage)} → ${stageName(e.to_stage)}`,
    })),
    ...meetings.map(m => ({
      id: `meet-${m.id}`,
      type: 'reuniao' as const,
      author: null,
      at: m.created_at ?? m.met_on,
      title: 'Reunião',
      description: m.note ?? (m.met_on ? `Reunião em ${m.met_on}` : null),
    })),
    ...deals.map(d => ({
      id: `deal-${d.id}`,
      type: 'fechamento' as const,
      author: null,
      at: d.created_at ?? d.data_fechamento,
      title: 'Venda fechada',
      description: `US$ ${Number(d.valor_total_usd ?? 0).toLocaleString('en-US')}`,
    })),
    ...activities.map(a => ({
      id: `act-${a.id}`,
      type: 'atividade' as const,
      author: a.user_name,
      at: a.created_at,
      title: 'Atividade',
      description: a.description,
    })),
  ].sort(byNewest)

  // ---- Estatísticas ----
  const stats: LeadStats = {
    daysAsLead: daysSince(lead.received_at ?? lead.created_at),
    daysStuck: daysSince(lead.stage_changed_at ?? lead.created_at),
    contacts: interactions.filter(i => i.type !== 'nota').length,
    meetings: meetings.length,
    proposals: stageEvents.filter(e => proposalSlugs.has(e.to_stage)).length,
    observations: interactions.filter(i => i.type === 'nota').length,
    movements: stageEvents.length,
  }

  // ---- Pipeline (histórico de movimentações; fallback = fase atual) ----
  let pipeline: LeadPipelineStep[]
  if (stageEvents.length > 0) {
    pipeline = stageEvents.map((e, idx) => {
      const next = stageEvents[idx + 1] ?? null
      return {
        slug: e.to_stage,
        stage: stageName(e.to_stage),
        enteredAt: e.changed_at,
        durationDays: next ? daysBetween(e.changed_at, next.changed_at) : daysSince(e.changed_at),
        movedBy: e.seller_name,
        current: !next && e.to_stage === lead.status,
      }
    })
  } else {
    pipeline = [{
      slug: lead.status ?? '',
      stage: stageName(lead.status),
      enteredAt: lead.stage_changed_at ?? lead.created_at,
      durationDays: daysSince(lead.stage_changed_at ?? lead.created_at),
      movedBy: lead.assigned_name,
      current: true,
    }]
  }

  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    origem: lead.origem,
    nicho: lead.nicho,
    responsavel: lead.assigned_name,
    stageSlug: lead.status,
    stageName: stageName(lead.status),
    expectedValue: lead.value,
    createdAt: lead.created_at,
    receivedAt: lead.received_at,
    stageChangedAt: lead.stage_changed_at,
    nextContact: lead.next_contact,
    notes: lead.notes,
    stats,
    timeline,
    pipeline,
    files: [],
  }
}

// Cria uma observação pelo Hub (ARCH-001: UI → Action → Service → Repository). Verifica a posse do lead
// (isolamento) antes de gravar. Reusa lead_interactions (não altera o fluxo existente do LeadDiary).
export async function addLeadObservation(context: RequestContext, leadId: string, text: string): Promise<LeadTimelineItem | null> {
  const teamId = context.activeTeamId
  if (!teamId) return null
  const clean = text.trim()
  if (!clean) return null

  const raw = await getLeadById(leadId)
  if (!raw) return null
  const lead = raw as unknown as LeadRow
  if (lead.team_id !== teamId) return null

  const row = await Timeline.addObservation({
    leadId,
    note: clean,
    createdBy: context.user.id,
    createdByName: context.profile?.name ?? null,
  })

  return {
    id: `int-${row.id}`,
    type: 'observacao',
    author: row.created_by_name,
    at: row.created_at,
    title: 'Observação',
    description: row.note,
  }
}
