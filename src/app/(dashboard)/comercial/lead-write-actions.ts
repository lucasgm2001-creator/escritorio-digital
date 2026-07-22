'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_TASK_OWNER_ID, DEFAULT_TASK_OWNER_NAME } from '@/lib/tasks/default-task-owner'
import { pickAllowed, requireActionContext } from '@/server/actions/safe-action'
import { getStages } from '@/lib/funnelStages.server'
import { wonSlug, marcosForSlug } from '@/lib/funnelStages'
import { markMilestones } from '@/lib/leadMilestones'
import { logStageEvent } from '@/lib/stageEvents'
import { saveLeadHistory, type LeadHistoryInput } from '@/lib/commission/actions'
import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'
import { moveLead, type ActionNote, type MovableLead } from './leadActions'
import { eventBus, createDomainEvent } from '@/lib/events/runtime'
import {
  LAST_ACTION_LABEL, NEXT_ACTION_LABEL, deriveFollowupState, nextContactFromWhen,
  isLastAction, isNextAction, isTemperature, suggestedStageFromSituation,
  type LastAction, type NextAction, type Temperature, type LeadResponse, type WhenChoice,
} from '@/lib/commercial/situation'
import { taskKindForNextAction, inferTaskKind } from '@/lib/tasks/task-kind'
import { withDefaultLeadOwner } from '@/lib/commercial/default-lead-owner'
import type { Lead, LeadStatus } from './types'

// Escritas do Comercial roteadas pelo SERVIDOR (PERMISSIONS-003): UI → action → can()/requirePermission →
// helper/Supabase. Fecha a brecha read×edit das escritas que saíam direto do browser. A AUTORIDADE é o
// servidor: um member com 'read' é barrado AQUI, mesmo chamando a action pelo DevTools. RLS (team_scope)
// segue valendo por baixo; nenhuma regra de negócio muda — reusa moveLead/markMilestones/logStageEvent.
// team_id é carimbado com a equipe ativa do contexto (nunca vem da UI).

type Err = { ok: false; error: string }
type Res<T = object> = ({ ok: true } & T) | Err

const DENY_EDIT = 'Você não tem permissão para editar no Comercial.'
const DENY_CREATE = 'Você não tem permissão para criar no Comercial.'
const DENY_DELETE = 'Você não tem permissão para excluir no Comercial.'
const EXPIRED = 'Sessão expirada. Entre novamente.'

// Colunas de lead que a UI pode gravar (allowlist). Bloqueia patch arbitrário de team_id/id/contact_code/etc.
// vindo de uma chamada direta. status/stage_changed_at passam por moveLeadAction; score/last_contact_at pela
// interação — não entram aqui.
const LEAD_COLS = [
  'name', 'company', 'email', 'phone', 'value', 'operation', 'notes', 'nicho', 'origem', 'prioridade',
  'next_contact', 'received_at', 'fuso', 'city', 'state', 'area_code', 'assigned_to', 'assigned_name',
  'created_manually', 'incluir_no_relatorio',
] as const
// Para CRIAÇÃO também aceitamos score/status (a UI define a fase e o score inicial de entrada).
const LEAD_CREATE_COLS = [...LEAD_COLS, 'score', 'status'] as const

async function guard(action: 'create' | 'edit' | 'delete', deny: string) {
  const g = await requireActionContext({
    permission: { module: 'commercial', action },
    deniedMessage: deny,
    expiredMessage: EXPIRED,
  })

  return g.context ? { context: g.context, error: null } as const : { context: null, error: g.error.message } as const
}

// Cria um lead (funil manual ou "já é cliente"). A UI monta o payload; aqui filtramos, carimbamos team_id,
// registramos entrada no funil (opcional) + atividade. Devolve o lead criado para o estado otimista.
export async function createLeadAction(
  input: Record<string, unknown>,
  opts: { activity?: string; logStage: boolean },
): Promise<Res<{ lead: Lead }>> {
  const g = await guard('create', DENY_CREATE)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const payload = { ...withDefaultLeadOwner(pickAllowed(input, LEAD_CREATE_COLS)), ...(teamId ? { team_id: teamId } : {}) }

  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar o lead.' }

  if (opts.logStage) {
    await logStageEvent(supabase, {
      leadId: data.id, leadName: data.name,
      fromStage: null, toStage: data.status ?? 'novo',
      sellerId: data.assigned_to ?? null, sellerName: data.assigned_name ?? null,
    }, teamId)
  }
  // Atividade no feed é opcional (o funil registra; o agente não registrava — preserva o comportamento).
  if (opts.activity) {
    await supabase.from('activities').insert({
      type: 'lead', description: opts.activity, user_name: g.context.profile?.name ?? null,
      entity_id: data.id, ...(teamId ? { team_id: teamId } : {}),
    })
  }
  return { ok: true, lead: data as Lead }
}

// LEAD histórico (CLIENT-HISTORY-ADMIN-003, Parte 4): dado um lead, reconstrói a jornada (received_at, 1º
// contato, reunião, proposta, [venda]) nas DATAS reais reusando saveLeadHistory (mesmo helper do cliente).
// Usa a SESSÃO (RLS é a autoridade — sem service-role): as escritas são team-scoped e o created_at histórico
// é só valor de coluna. Reflete no funil/Radar/Hall/relatórios/timeline sem reconstrução manual.
export async function saveLeadHistoryAction(leadId: string, history: LeadHistoryInput): Promise<Res<{ stageEvents: number; createdMeeting: boolean }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createServiceClient()
  const { data: ownedLead } = await supabase.from('leads').select('id').eq('id', leadId).eq('team_id', g.context.activeTeamId).is('deleted_at', null).maybeSingle()
  if (!ownedLead) return { ok: false, error: 'Lead não encontrado nesta equipe.' }
  const stages = await getStages()
  const won = wonSlug(stages)
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const rate = resolveRate(fxc, Number(fx?.cotacao_referencia) || manual || 5.4) || 5.4
  const r = await saveLeadHistory(supabase as Parameters<typeof saveLeadHistory>[0], leadId, history, won, rate, g.context.activeTeamId)
  if (!r.ok) return { ok: false, error: 'Lead não encontrado.' }
  return { ok: true, stageEvents: r.stageEvents, createdMeeting: r.createdMeeting }
}

// Atualiza campos editáveis de um lead (responsável, datas, valor, edição completa…). Um único ponto para
// todos os updates de lead do diário — filtrado pela allowlist.
export async function updateLeadAction(leadId: string, patch: Record<string, unknown>): Promise<Res> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const clean = pickAllowed(patch, LEAD_COLS)
  if (Object.keys(clean).length === 0) return { ok: true }
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca muta lead de outra equipe.
  let q = supabase.from('leads').update(clean).eq('id', leadId)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Move um lead de fase — reusa moveLead (won-flow/comissão/histórico) sem duplicar nada.
export async function moveLeadAction(lead: MovableLead, newStatus: LeadStatus, planoId: string | null = null): Promise<Res<{ notes: ActionNote[] }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const session = createClient()
  // Unificação da Lixeira (F4): mover para 'lixeira' = EXCLUIR (soft_delete_lead, owner-only). deleted_at é a
  // fonte OFICIAL de exclusão — não mais o status. Assim não há dois sistemas de "lixeira".
  if (newStatus === 'lixeira') {
    const { error } = await session.rpc('soft_delete_lead', { p_lead_id: lead.id })
    if (error) return { ok: false, error: /owner/i.test(error.message) ? 'Apenas o owner da equipe pode excluir.' : error.message }
    return { ok: true, notes: [{ message: 'Lead excluído (Lixeira).', type: 'success' }] }
  }
  // O fluxo de fechamento escreve nos ledgers financeiros com service-role somente depois da
  // autorização acima e de confirmar que o lead pertence à equipe ativa.
  const supabase = createServiceClient()
  const { data: ownedLead } = await supabase.from('leads')
    .select('id, name, status, email, phone, company, assigned_to, assigned_name, city, state, area_code')
    .eq('id', lead.id).eq('team_id', g.context.activeTeamId).is('deleted_at', null).maybeSingle()
  if (!ownedLead) return { ok: false, error: 'Lead não encontrado nesta equipe.' }
  const stages = await getStages()
  const res = await moveLead(supabase as Parameters<typeof moveLead>[0], ownedLead as MovableLead, newStatus, g.context.profile?.name ?? '—', stages, planoId, g.context.user.id, g.context.activeTeamId)
  if (!res.ok) return { ok: false, error: res.error ?? 'Não foi possível mover o lead.' }
  return { ok: true, notes: res.notes }
}

// Excluir lead (SOFT DELETE global, F4) — OWNER-ONLY (o RPC soft_delete_lead valida via require_owner). Não
// apaga fisicamente: some de tudo (RLS) e é reversível na Lixeira. deleted_at é a fonte oficial (unifica a
// lixeira antiga). O guard('delete') barra member; o RPC garante owner-only de fato.
export async function deleteLeadAction(leadId: string): Promise<Res> {
  const g = await guard('delete', DENY_DELETE)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const { error } = await supabase.rpc('soft_delete_lead', { p_lead_id: leadId })
  if (error) return { ok: false, error: /owner/i.test(error.message) ? 'Apenas o owner da equipe pode excluir.' : error.message }
  return { ok: true }
}

// Exclusão em lote (ex.: contatos duplicados) → soft delete de cada um (owner-only).
export async function deleteLeadsAction(ids: string[]): Promise<Res> {
  const g = await guard('delete', DENY_DELETE)
  if (!g.context) return { ok: false, error: g.error }
  if (ids.length === 0) return { ok: true }
  const supabase = createClient()
  for (const id of ids) {
    const { error } = await supabase.rpc('soft_delete_lead', { p_lead_id: id })
    if (error) return { ok: false, error: /owner/i.test(error.message) ? 'Apenas o owner da equipe pode excluir.' : error.message }
  }
  return { ok: true }
}

// Registra uma interação (contato) + aplica o score/marco. Mesma regra do funil/diário, agora no servidor.
export async function addLeadInteractionAction(input: {
  leadId: string
  type: string
  note?: string | null
  currentScore: number
}): Promise<Res<{ newScore: number; interaction: Record<string, unknown> | null }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const delta = ({ atendeu: 80, mensagem: 20, nao_atendeu: -30 } as Record<string, number>)[input.type] ?? 0
  const nowIso = new Date().toISOString()

  const { data: interaction, error } = await supabase.from('lead_interactions').insert({
    lead_id: input.leadId, type: input.type, note: input.note ?? null, score_delta: delta,
    created_by: g.context.user.id, created_by_name: g.context.profile?.name ?? null,
    ...(teamId ? { team_id: teamId } : {}),
  }).select().single()
  if (error) return { ok: false, error: error.message }

  if (input.type === 'atendeu' || input.type === 'mensagem') await markMilestones(supabase, input.leadId, ['interagiu'], teamId)
  const newScore = Math.max(0, Math.min(1000, (input.currentScore ?? 0) + delta))
  let lq = supabase.from('leads').update({ score: newScore, last_contact_at: nowIso }).eq('id', input.leadId)
  if (teamId) lq = lq.eq('team_id', teamId)   // defense-in-depth (teamId já resolvido acima)
  await lq
  return { ok: true, newScore, interaction: (interaction as Record<string, unknown>) ?? null }
}

// Tarefa vinculada a um lead (tasks.linked_type='lead'). Criar/concluir = editar o Comercial.
export async function createLeadTaskAction(input: { leadId: string; leadName: string; title: string }): Promise<Res<{ task: Record<string, unknown> }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const title = input.title.trim()
  if (!title) return { ok: false, error: 'Escreva um título para a tarefa.' }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('tasks').insert({
    user_id: g.context.user.id, title, kind: inferTaskKind(title), done: false,
    linked_type: 'lead', linked_id: input.leadId, linked_name: input.leadName,
    responsavel_id: DEFAULT_TASK_OWNER_ID, responsavel_nome: DEFAULT_TASK_OWNER_NAME,
    ...(teamId ? { team_id: teamId } : {}),
  }).select('id, title, due_date, due_time, done, kind').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar a tarefa.' }
  return { ok: true, task: data as Record<string, unknown> }
}

export async function setLeadTaskDoneAction(taskId: string, done: boolean): Promise<Res> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── RADAR-COMERCIAL-001: atualiza a SITUAÇÃO do lead (fluxo rápido ao concluir tarefa ou edição no Radar) ──
// Autoridade no servidor (commercial.edit). Grava os campos de situação (migration 045) + registra histórico
// em lead_interactions (NÃO duplica timeline) + cria a próxima tarefa quando há próxima ação + publica eventos.
// current_situation vazio → usa o rótulo do resultado (honesto, não fake). next_action_at reusa next_contact.
export async function updateLeadSituationAction(input: {
  leadId: string
  sourceTaskId?: string | null
  currentSituation?: string | null
  lastAction: LastAction
  nextAction: NextAction
  when?: WhenChoice | null
  explicitDate?: string | null
  temperature?: Temperature | null
  response?: LeadResponse | null
  note?: string | null
}): Promise<Res<{ nextTask: Record<string, unknown> | null }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  if (!isLastAction(input.lastAction)) return { ok: false, error: 'Resultado inválido.' }
  if (!isNextAction(input.nextAction)) return { ok: false, error: 'Próxima ação inválida.' }
  if (input.temperature != null && !isTemperature(input.temperature)) return { ok: false, error: 'Temperatura inválida.' }

  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const now = new Date()
  const when = input.when ?? null
  const followupState = deriveFollowupState(input.lastAction, input.nextAction, when)
  const situation = input.currentSituation?.trim() || LAST_ACTION_LABEL[input.lastAction]

  let ownedQuery = supabase.from('leads')
    .select('id, name, status, assigned_to, assigned_name')
    .eq('id', input.leadId)
  if (teamId) ownedQuery = ownedQuery.eq('team_id', teamId)
  const { data: currentLead } = await ownedQuery.maybeSingle()
  if (!currentLead) return { ok: false, error: 'Lead não encontrado nesta equipe.' }
  const suggestedStage = suggestedStageFromSituation(input.lastAction, currentLead.status)

  // next_contact (= data da próxima ação): 'nenhuma' limpa; com "quando" define; senão não mexe.
  let nextContact: string | null | undefined = undefined
  if (input.nextAction === 'nenhuma') nextContact = null
  else if (when) nextContact = nextContactFromWhen(when, input.explicitDate ?? null, now)

  // 1) campos de situação do lead
  const patch: Record<string, unknown> = {
    current_situation: situation,
    last_action: input.lastAction,
    next_action: input.nextAction,
    followup_state: followupState,
    situation_updated_at: now.toISOString(),
    last_contact_at: now.toISOString(),
  }
  if (suggestedStage && suggestedStage !== currentLead.status) {
    patch.status = suggestedStage
    patch.stage_changed_at = now.toISOString()
    patch.updated_at = now.toISOString()
  }
  if (input.temperature != null) patch.temperature = input.temperature
  if (nextContact !== undefined) patch.next_contact = nextContact
  let lq = supabase.from('leads').update(patch).eq('id', input.leadId)
  if (teamId) lq = lq.eq('team_id', teamId)   // defense-in-depth (teamId já resolvido acima)
  const { data: lead, error } = await lq.select('id, name').single()
  if (error || !lead) return { ok: false, error: error?.message ?? 'Não foi possível atualizar a situação.' }

  // A resposta atualiza a fase do funil e, por consequência, Radar, métricas e histórico. Este fluxo só
  // sugere fases operacionais; fechamento financeiro continua no fluxo específico do funil.
  if (suggestedStage && suggestedStage !== currentLead.status) {
    await logStageEvent(supabase, {
      leadId: lead.id, leadName: lead.name, fromStage: currentLead.status, toStage: suggestedStage,
      sellerId: currentLead.assigned_to ?? null, sellerName: currentLead.assigned_name ?? null,
    }, teamId)
    const stages = await getStages()
    await markMilestones(supabase, lead.id, marcosForSlug(stages, suggestedStage), teamId)
    await supabase.from('activities').insert({
      type: 'lead', description: `${lead.name}: ${LAST_ACTION_LABEL[input.lastAction]}`,
      user_name: g.context.profile?.name ?? null, user_id: g.context.user.id, entity_id: lead.id,
      ...(teamId ? { team_id: teamId } : {}),
    })
  }

  // 2) histórico (reusa lead_interactions — sem duplicar timeline)
  await supabase.from('lead_interactions').insert({
    // A fase/resultado já vive nos campos estruturados do lead. Só grava como observação quando a pessoa
    // realmente escreveu contexto; assim a aba permanente não é poluída por rótulos automáticos.
    lead_id: input.leadId, type: 'situacao', note: input.note?.trim() || null, score_delta: 0,
    created_by: g.context.user.id, created_by_name: g.context.profile?.name ?? null,
    ...(teamId ? { team_id: teamId } : {}),
  })

  // 3) próxima tarefa. Quando a interação nasceu de uma tarefa, REUTILIZA a mesma linha em vez de
  // criar cópias a cada tentativa. Assim "não atendeu" registra trabalho realizado e só volta à fila
  // se o usuário escolher uma nova ação com data. 'aguardar'/'nenhuma' encerram a tentativa atual.
  let nextTask: Record<string, unknown> | null = null
  if (input.nextAction !== 'nenhuma' && input.nextAction !== 'aguardar') {
    const confirmedMeeting = input.lastAction === 'agendamento_confirmado'
    const taskPatch = {
      title: confirmedMeeting ? `Reunião: ${lead.name}` : `${NEXT_ACTION_LABEL[input.nextAction]}: ${lead.name}`,
      done: false,
      completed_at: null,
      linked_type: 'lead' as const,
      linked_id: input.leadId,
      linked_name: lead.name,
      add_call: input.nextAction === 'ligar',
      kind: confirmedMeeting ? 'reuniao' : taskKindForNextAction(input.nextAction),
      due_date: nextContact ?? null,
    }
    let task: Record<string, unknown> | null = null
    if (input.sourceTaskId) {
      let tq = supabase.from('tasks').update(taskPatch)
        .eq('id', input.sourceTaskId)
        .eq('linked_type', 'lead')
        .eq('linked_id', input.leadId)
      if (teamId) tq = tq.eq('team_id', teamId)
      const { data, error: taskError } = await tq.select().single()
      if (taskError || !data) return { ok: false, error: taskError?.message ?? 'Não foi possível reagendar a tarefa atual.' }
      task = (data as Record<string, unknown>) ?? null
    } else {
      const { data, error: taskError } = await supabase.from('tasks').insert({
        ...taskPatch,
        user_id: g.context.user.id,
        responsavel_id: DEFAULT_TASK_OWNER_ID,
        responsavel_nome: DEFAULT_TASK_OWNER_NAME,
        ...(teamId ? { team_id: teamId } : {}),
      }).select().single()
      if (taskError || !data) return { ok: false, error: taskError?.message ?? 'Não foi possível criar a próxima tarefa.' }
      task = (data as Record<string, unknown>) ?? null
    }
    nextTask = (task as Record<string, unknown>) ?? null
  }

  // 4) Event Bus (best-effort — barramento em memória; contratos prontos)
  try {
    const ctx = { teamId: teamId ?? '', userId: g.context.user.id, requestId: null }
    await eventBus.publish(createDomainEvent('lead.situation.updated', 'lead', { leadId: input.leadId, followupState }, ctx, { source: 'Comercial', entity: { kind: 'lead', id: input.leadId } }))
    if (input.response) await eventBus.publish(createDomainEvent('lead.response.recorded', 'lead', { leadId: input.leadId, response: input.response }, ctx, { source: 'Comercial' }))
    if (nextTask) await eventBus.publish(createDomainEvent('lead.next_action.created', 'lead', { leadId: input.leadId, nextAction: input.nextAction }, ctx, { source: 'Comercial' }))
    if (nextContact && input.nextAction !== 'aguardar') await eventBus.publish(createDomainEvent('lead.followup.scheduled', 'lead', { leadId: input.leadId, when: nextContact }, ctx, { source: 'Comercial' }))
  } catch { /* barramento em memória — não bloqueia a ação */ }

  return { ok: true, nextTask }
}
