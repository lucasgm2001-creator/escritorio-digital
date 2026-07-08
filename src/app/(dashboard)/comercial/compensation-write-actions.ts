'use server'

import { createClient } from '@/lib/supabase/server'
import { requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'
import { payWeek, registerMeeting, ensureClient, type PayWeekReason } from '@/lib/commission/actions'
import { markMilestones } from '@/lib/leadMilestones'

// Escritas de COMISSÃO/REMUNERAÇÃO (financeiro — PERMISSIONS-004). Ação SENSÍVEL → exige ADMIN do módulo
// Financeiro: can(finance,'approve') só é verdadeiro no nível 'admin' (o modelo de níveis não concede
// approve/export em edit/read). Owner/admin da equipe = admin em tudo → passam. Member (read/edit) = negado.
// REUSA os helpers financeiros (payWeek/registerMeeting/ensureClient) com o client de SERVIDOR — a regra de
// dinheiro e o cálculo NÃO mudam; só o caminho (browser → action gated). team_id carimbado no servidor.
type WriteError = ActionError
type Row = Record<string, unknown>

const DENY = 'Você não tem acesso de administrador ao Financeiro.'

async function guardFinanceAdmin() {
  return requireActionContext({
    permission: { module: 'finance', action: 'approve' },
    deniedMessage: DENY,
  })
}

// ── fx_config ──────────────────────────────────────────────────────────────────────────────────────
export async function updateFxConfigAction(patch: { cotacao_manual: number | null; cotacao_travada: boolean }): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('fx_config')
    .update({ cotacao_manual: patch.cotacao_manual, cotacao_travada: patch.cotacao_travada, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return { error: toActionError(error) }
}

// ── seller_salaries (novo período; nunca reescreve o passado) ────────────────────────────────────────
export async function addSalaryAction(input: { sellerId: string; valorUsd: number; effectiveFrom: string }): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('seller_salaries')
    .insert({ seller_id: input.sellerId, valor_usd: input.valorUsd, effective_from: input.effectiveFrom, ...(teamId ? { team_id: teamId } : {}) })
    .select('seller_id, valor_usd, effective_from').single()
  return { data: (data as Row) ?? null, error: toActionError(error) }
}

// ── deals ────────────────────────────────────────────────────────────────────────────────────────────
export async function createDealAction(input: {
  sellerId: string; client: string; sellerName: string | null; total: number; semanas: number; vps: number; dataFechamento: string
}): Promise<{ data: Row | null; clientId: string | null; error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { data: null, clientId: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const clientId = await ensureClient(supabase, input.client, { assignedName: input.sellerName }, teamId)   // reuso — nunca deal órfão
  if (!clientId) return { data: null, clientId: null, error: { message: 'Não foi possível vincular/criar o cliente.' } }
  const { data, error } = await supabase.from('deals').insert({
    seller_id: input.sellerId, client_id: clientId, client_name: input.client.trim(),
    valor_total_usd: input.total, teto_semanas: input.semanas, valor_por_semana_usd: input.vps,
    status: 'em_andamento', data_fechamento: input.dataFechamento, ...(teamId ? { team_id: teamId } : {}),
  }).select('id, seller_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd, status, data_fechamento').single()
  return { data: (data as Row) ?? null, clientId, error: toActionError(error) }
}

export async function updateDealStatusAction(id: string, status: string): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — NUNCA muta linha de outra equipe,
  // mesmo que a RLS seja alterada no futuro. Comportamento inalterado (a linha legítima é da equipe ativa).
  const teamId = g.context.activeTeamId
  let q = supabase.from('deals').update({ status }).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function deleteDealAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('deals').delete().eq('id', id)   // semanas caem por FK cascade
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function updateDealAction(id: string, input: {
  client: string; sellerName: string | null; total: number; semanas: number; vps: number; dataFechamento: string
}): Promise<{ clientId: string | null; error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { clientId: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const clientId = await ensureClient(supabase, input.client, { assignedName: input.sellerName }, teamId)
  if (!clientId) return { clientId: null, error: { message: 'Não foi possível vincular/criar o cliente.' } }
  let q = supabase.from('deals').update({
    client_id: clientId, client_name: input.client.trim(),
    valor_total_usd: input.total, teto_semanas: input.semanas, valor_por_semana_usd: input.vps, data_fechamento: input.dataFechamento,
  }).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)   // defense-in-depth (teamId já resolvido acima p/ ensureClient)
  const { error } = await q
  return { clientId, error: toActionError(error) }
}

// ── weekly_payments (semanas pagas) ───────────────────────────────────────────────────────────────────
export async function payWeekAction(
  deal: { id: string; valorPorSemanaUsd: number; tetoSemanas: number; status: string },
  paidNumbers: number[], numero: number, paidOn: string, rate: number,
): Promise<{ ok: boolean; reason?: PayWeekReason; message?: string; row?: Row }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { ok: false, reason: 'db', message: g.error?.message }
  const supabase = createClient()
  return payWeek(supabase, deal, paidNumbers, numero, paidOn, rate, g.context.activeTeamId)   // reuso — regra de dinheiro intacta
}

export async function deleteWeekAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('weekly_payments').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function updateWeekDateAction(id: string, paidOn: string): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('weekly_payments').update({ paid_on: paidOn }).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

// ── meetings (gestão financeira; a comissão automática de reunião vem por moveLead/commercial.edit) ────
export async function registerMeetingAction(input: {
  sellerId: string; metOn: string; valorUsd: number; clientId: string | null; clientName: string | null; note: string | null; leadId: string | null; rate: number
}): Promise<{ data: Row | null; error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await registerMeeting(supabase, input.sellerId, {
    metOn: input.metOn, valorUsd: input.valorUsd, clientId: input.clientId, clientName: input.clientName, note: input.note, leadId: input.leadId,
  }, input.rate, teamId)
  if (error) return { data: null, error: toActionError(error) }
  if (input.leadId) await markMilestones(supabase, input.leadId, ['reuniao'], teamId)   // marco do relatório (idempotente)
  return { data: (data as Row) ?? null, error: null }
}

export async function deleteMeetingAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('meetings').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function updateMeetingAction(id: string, patch: { metOn: string; valorUsd: number; clientId: string | null; clientName: string | null }): Promise<{ error: WriteError }> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('meetings')
    .update({ met_on: patch.metOn, valor_usd: patch.valorUsd, client_id: patch.clientId, client_name: patch.clientName }).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}
