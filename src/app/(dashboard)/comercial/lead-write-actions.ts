'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'
import { getStages } from '@/lib/funnelStages.server'
import { markMilestones } from '@/lib/leadMilestones'
import { logStageEvent } from '@/lib/stageEvents'
import { moveLead, type ActionNote, type MovableLead } from './leadActions'
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

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guard(action: 'create' | 'edit' | 'delete', deny: string) {
  const context = await getRequestContext()
  if (!context) return { context: null, error: EXPIRED } as const
  if (!can(context, 'commercial', action)) return { context: null, error: deny } as const
  return { context, error: null } as const
}

// Cria um lead (funil manual ou "já é cliente"). A UI monta o payload; aqui filtramos, carimbamos team_id,
// registramos entrada no funil (opcional) + atividade. Devolve o lead criado para o estado otimista.
export async function createLeadAction(
  input: Record<string, unknown>,
  opts: { activity: string; logStage: boolean },
): Promise<Res<{ lead: Lead }>> {
  const g = await guard('create', DENY_CREATE)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const payload = { ...pick(input, LEAD_CREATE_COLS), ...(teamId ? { team_id: teamId } : {}) }

  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar o lead.' }

  if (opts.logStage) {
    await logStageEvent(supabase, {
      leadId: data.id, leadName: data.name,
      fromStage: null, toStage: data.status ?? 'novo',
      sellerId: data.assigned_to ?? null, sellerName: data.assigned_name ?? null,
    }, teamId)
  }
  await supabase.from('activities').insert({
    type: 'lead', description: opts.activity, user_name: g.context.profile?.name ?? null,
    entity_id: data.id, ...(teamId ? { team_id: teamId } : {}),
  })
  return { ok: true, lead: data as Lead }
}

// Atualiza campos editáveis de um lead (responsável, datas, valor, edição completa…). Um único ponto para
// todos os updates de lead do diário — filtrado pela allowlist.
export async function updateLeadAction(leadId: string, patch: Record<string, unknown>): Promise<Res> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const clean = pick(patch, LEAD_COLS)
  if (Object.keys(clean).length === 0) return { ok: true }
  const { error } = await supabase.from('leads').update(clean).eq('id', leadId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Move um lead de fase — reusa moveLead (won-flow/comissão/histórico) sem duplicar nada.
export async function moveLeadAction(lead: MovableLead, newStatus: LeadStatus, planoId: string | null = null): Promise<Res<{ notes: ActionNote[] }>> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const stages = await getStages()
  const res = await moveLead(supabase, lead, newStatus, g.context.profile?.name ?? '—', stages, planoId, g.context.user.id, g.context.activeTeamId)
  if (!res.ok) return { ok: false, error: res.error ?? 'Não foi possível mover o lead.' }
  return { ok: true, notes: res.notes }
}

// Exclui um lead. Excluir é ação forte → exige 'delete' (nível admin no módulo).
export async function deleteLeadAction(leadId: string): Promise<Res> {
  const g = await guard('delete', DENY_DELETE)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Exclusão em lote (ex.: contatos duplicados) — mesma exigência: 'delete'.
export async function deleteLeadsAction(ids: string[]): Promise<Res> {
  const g = await guard('delete', DENY_DELETE)
  if (!g.context) return { ok: false, error: g.error }
  if (ids.length === 0) return { ok: true }
  const supabase = createClient()
  const { error } = await supabase.from('leads').delete().in('id', ids)
  if (error) return { ok: false, error: error.message }
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
  await supabase.from('leads').update({ score: newScore, last_contact_at: nowIso }).eq('id', input.leadId)
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
    user_id: g.context.user.id, title, done: false,
    linked_type: 'lead', linked_id: input.leadId, linked_name: input.leadName,
    ...(teamId ? { team_id: teamId } : {}),
  }).select('id, title, due_date, due_time, done').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar a tarefa.' }
  return { ok: true, task: data as Record<string, unknown> }
}

export async function setLeadTaskDoneAction(taskId: string, done: boolean): Promise<Res> {
  const g = await guard('edit', DENY_EDIT)
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
