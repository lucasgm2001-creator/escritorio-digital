import 'server-only'

import type {
  LeadExecutive, LeadHealth, LeadHubVM, LeadJourneyStep, LeadPipelineStep, LeadStats,
  LeadTemperature, LeadTimelineItem, LeadTimelineOrigin,
} from '@/lib/commercial/lead-hub-types'
import { categoryForInteractionType } from '@/lib/commercial/lead-categories'
import { getLeadById } from '@/server/repositories/LeadRepository'
import * as Timeline from '@/server/repositories/LeadTimelineRepository'
import { getStages } from '@/lib/funnelStages.server'
import { noopEventPublisher } from '@/core/events/publisher'
import type { RequestContext } from '@/server/context/request-context'

// Regra de negócio do Hub do Lead (ARCH-001). Isolamento (TEAM-001): confere a posse do lead ANTES de
// carregar filhos. COMPÕE tudo (timeline universal + categorias/origem + saúde + executivo + jornada) —
// a UI recebe pronto. Estas mesmas leituras alimentarão Reporting/Dashboard/Forecast/IA sem duplicação.

type LeadRow = {
  id: string; team_id: string | null; name: string; company: string | null; email: string | null
  phone: string | null; value: number | null; status: string | null; assigned_name: string | null
  origem: string | null; nicho: string | null; notes: string | null; score: number | null
  created_at: string | null; received_at: string | null; stage_changed_at: string | null
  next_contact: string | null; last_contact_at: string | null
}

const DAY = 86_400_000
const t = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0)
const daysSince = (iso: string | null): number => (iso ? Math.max(0, Math.floor((Date.now() - t(iso)) / DAY)) : 0)
const daysBetween = (a: string | null, b: string | null): number | null =>
  a && b ? Math.max(0, Math.floor((t(b) - t(a)) / DAY)) : null
const maxDate = (list: (string | null)[]): string | null =>
  list.filter(Boolean).sort((a, b) => t(b) - t(a))[0] ?? null

export async function getLeadHub(context: RequestContext, leadId: string): Promise<LeadHubVM | null> {
  const teamId = context.activeTeamId
  if (!teamId) return null

  const raw = await getLeadById(leadId)
  if (!raw) return null
  const lead = raw as unknown as LeadRow
  if (lead.team_id !== teamId) return null // ISOLAMENTO (TEAM-001)

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

  // ---- Timeline universal (categoria + origem por item) ----
  const timeline: LeadTimelineItem[] = [
    ...interactions.map(i => ({
      id: `int-${i.id}`,
      type: (i.type === 'nota' ? 'observacao' : 'atividade') as LeadTimelineItem['type'],
      category: categoryForInteractionType(i.type),
      origin: 'manual' as LeadTimelineOrigin,
      author: i.created_by_name,
      at: i.created_at,
      title: i.type === 'nota' ? 'Observação' : 'Contato',
      description: i.note,
    })),
    ...stageEvents.map(e => ({
      id: `stg-${e.id}`,
      type: 'fase' as const,
      category: 'negociacao' as const,
      origin: 'sistema' as LeadTimelineOrigin,
      author: e.seller_name,
      at: e.changed_at,
      title: 'Mudança de fase',
      description: `${stageName(e.from_stage)} → ${stageName(e.to_stage)}`,
    })),
    ...meetings.map(m => ({
      id: `meet-${m.id}`,
      type: 'reuniao' as const,
      category: 'reuniao' as const,
      origin: 'sistema' as LeadTimelineOrigin,
      author: null,
      at: m.created_at ?? m.met_on,
      title: 'Reunião',
      description: m.note ?? (m.met_on ? `Reunião em ${m.met_on}` : null),
    })),
    ...deals.map(d => ({
      id: `deal-${d.id}`,
      type: 'fechamento' as const,
      category: 'contrato' as const,
      origin: 'sistema' as LeadTimelineOrigin,
      author: null,
      at: d.created_at ?? d.data_fechamento,
      title: 'Venda fechada',
      description: `US$ ${Number(d.valor_total_usd ?? 0).toLocaleString('en-US')}`,
    })),
    ...activities.map(a => ({
      id: `act-${a.id}`,
      type: 'atividade' as const,
      category: 'informacao' as const,
      origin: 'automacao' as LeadTimelineOrigin,
      author: a.user_name,
      at: a.created_at,
      title: 'Atividade',
      description: a.description,
    })),
  ].sort((a, b) => t(b.at) - t(a.at))

  // ---- Estatísticas ----
  const contacts = interactions.filter(i => i.type !== 'nota').length
  const observations = interactions.filter(i => i.type === 'nota').length
  const proposals = stageEvents.filter(e => proposalSlugs.has(e.to_stage)).length
  const stats: LeadStats = {
    daysAsLead: daysSince(lead.received_at ?? lead.created_at),
    daysStuck: daysSince(lead.stage_changed_at ?? lead.created_at),
    contacts, meetings: meetings.length, proposals, observations, movements: stageEvents.length,
  }

  // ---- Lead Health ----
  const lastMeetingAt = maxDate(meetings.map(m => m.created_at ?? m.met_on))
  const lastProposalAt = maxDate(stageEvents.filter(e => proposalSlugs.has(e.to_stage)).map(e => e.changed_at))
  const health: LeadHealth = {
    daysStuck: stats.daysStuck,
    daysInStage: daysSince(lead.stage_changed_at ?? lead.created_at),
    lastContactAt: lead.last_contact_at ?? maxDate(interactions.map(i => i.created_at)),
    lastMeetingAt,
    lastProposalAt,
    movements: stats.movements, observations, meetings: meetings.length, proposals, contacts,
  }

  // ---- Painel Executivo ----
  const score = lead.score
  const lastActivityAt = timeline[0]?.at ?? null
  const daysSinceActivity = daysSince(lastActivityAt)
  let temperature: LeadTemperature = 'frio'
  if (daysSinceActivity <= 3 && (score ?? 0) >= 50) temperature = 'quente'
  else if (daysSinceActivity <= 14) temperature = 'morno'
  const executive: LeadExecutive = {
    score,
    chance: null, // placeholder (IA/Forecast futuro)
    temperature,
    status: stageName(lead.status),
    avgDaysPerStage: stats.movements > 0 ? Math.round(stats.daysAsLead / stats.movements) : null,
    lastActivityAt,
  }

  // ---- Jornada visual (Lead criado → Cliente) ----
  const wonSlugs = new Set(stages.filter(s => s.is_won).map(s => s.slug))
  const journey: LeadJourneyStep[] = [
    { key: 'criado', label: 'Lead criado', done: true, at: lead.received_at ?? lead.created_at },
    { key: 'contato', label: 'Contato', done: contacts > 0 || !!health.lastContactAt, at: health.lastContactAt },
    { key: 'reuniao', label: 'Reunião', done: meetings.length > 0, at: lastMeetingAt },
    { key: 'proposta', label: 'Proposta', done: proposals > 0, at: lastProposalAt },
    { key: 'fechamento', label: 'Fechamento', done: deals.length > 0 || (lead.status ? wonSlugs.has(lead.status) : false), at: maxDate(deals.map(d => d.data_fechamento ?? d.created_at)) },
    { key: 'cliente', label: 'Cliente', done: deals.length > 0, at: maxDate(deals.map(d => d.data_fechamento ?? d.created_at)) },
  ]

  // ---- Pipeline (histórico comercial) ----
  let pipeline: LeadPipelineStep[]
  if (stageEvents.length > 0) {
    pipeline = stageEvents.map((e, idx) => {
      const next = stageEvents[idx + 1] ?? null
      return {
        slug: e.to_stage, stage: stageName(e.to_stage), enteredAt: e.changed_at,
        durationDays: next ? daysBetween(e.changed_at, next.changed_at) : daysSince(e.changed_at),
        movedBy: e.seller_name, current: !next && e.to_stage === lead.status,
      }
    })
  } else {
    pipeline = [{
      slug: lead.status ?? '', stage: stageName(lead.status), enteredAt: lead.stage_changed_at ?? lead.created_at,
      durationDays: daysSince(lead.stage_changed_at ?? lead.created_at), movedBy: lead.assigned_name, current: true,
    }]
  }

  return {
    id: lead.id, name: lead.name, company: lead.company, email: lead.email, phone: lead.phone,
    origem: lead.origem, nicho: lead.nicho, responsavel: lead.assigned_name,
    stageSlug: lead.status, stageName: stageName(lead.status), expectedValue: lead.value,
    createdAt: lead.created_at, receivedAt: lead.received_at, stageChangedAt: lead.stage_changed_at,
    nextContact: lead.next_contact, notes: lead.notes,
    stats, health, executive, journey, timeline, pipeline, files: [],
  }
}

// Cria uma observação pelo Hub (ARCH-001). Verifica a posse do lead antes de gravar (isolamento).
// Reusa lead_interactions (type 'nota') — não altera o fluxo existente do LeadDiary.
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
    leadId, note: clean, createdBy: context.user.id, createdByName: context.profile?.name ?? null,
  })

  // PONTO DE INTEGRAÇÃO — Event Bus (PLATFORM-003). Publisher é no-op nesta fase (EVENTS-001 liga o real);
  // quem publica não muda quando o Outbox existir. Alimentará Dashboard/Automação/IA/Notificações.
  await noopEventPublisher.publish({
    id: crypto.randomUUID(),
    type: 'lead.observation.created',
    scope: { workspaceId: null, teamId },
    payload: { leadId, interactionId: row.id },
    occurredAt: new Date().toISOString(),
    actorUserId: context.user.id,
  })

  return {
    id: `int-${row.id}`, type: 'observacao', category: 'informacao', origin: 'manual',
    author: row.created_by_name, at: row.created_at, title: 'Observação', description: row.note,
  }
}
