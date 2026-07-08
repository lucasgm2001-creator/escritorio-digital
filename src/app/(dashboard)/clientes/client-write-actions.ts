'use server'

import { createClient } from '@/lib/supabase/server'
import { pickAllowed, requireActionContext } from '@/server/actions/safe-action'
import { getRequestContext } from '@/server/context/request-context'
import { todaySP } from '@/lib/date'
import { createServiceClient } from '@/lib/supabase/service'
import { assertClientOwnership } from '@/server/security/team-ownership'
import { payMonth, nextUnpaidMonth, applyPlanUpgrade, saveClientHistory, type ClientHistoryInput } from '@/lib/commission/actions'
import { resolveRate } from '@/lib/commission/calc'
import { getStages } from '@/lib/funnelStages.server'
import { wonSlug } from '@/lib/funnelStages'
import type { FxConfig } from '@/lib/commission/types'

// Escritas do módulo Clientes roteadas pelo SERVIDOR (PERMISSIONS-003): UI → action → can('clients','edit') →
// Supabase. Fecha a brecha read×edit das escritas que saíam direto do browser. RLS (team_scope) segue por
// baixo; nada de regra de negócio muda. team_id é carimbado no servidor onde aplicável (nunca vem da UI).

type Err = { ok: false; error: string }
type Res<T = object> = ({ ok: true } & T) | Err

const DENY = 'Você não tem permissão para editar em Clientes.'
const EXPIRED = 'Sessão expirada. Entre novamente.'

// Allowlists — bloqueiam patch arbitrário vindo de chamada direta. Campos de dinheiro (plano/valor) NÃO
// entram aqui: mudam pelo fluxo de fechamento/comissão, não pela edição livre do cliente.
const CLIENT_COLS = ['name', 'company', 'email', 'phone', 'nicho', 'status', 'drive_folder_url', 'dossie'] as const
const NICHO_COLS = ['nome', 'cor', 'posicao', 'ativo'] as const
const INTEG_COLS = ['client_id', 'ativo', 'instancia', 'numero_destino', 'template', 'landing_pages', 'updated_at'] as const

async function guardEdit() {
  const g = await requireActionContext({
    permission: { module: 'clients', action: 'edit' },
    deniedMessage: DENY,
    expiredMessage: EXPIRED,
  })

  return g.context ? { context: g.context, error: null } as const : { context: null, error: g.error.message } as const
}

// Atualiza dados do cliente (dossiê, pasta do Drive, identidade). Filtrado pela allowlist.
export async function updateClientAction(clientId: string, patch: Record<string, unknown>): Promise<Res> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const clean = pickAllowed(patch, CLIENT_COLS)
  if (Object.keys(clean).length === 0) return { ok: true }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca muta cliente de outra equipe.
  let q = supabase.from('clients').update(clean).eq('id', clientId)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Desativa (rescisão/churn): status inativo + data de encerramento (hoje, autoridade do servidor) + motivo.
// NÃO mexe em comissão/receita já registradas — só o estado do cliente. Mesma guarda can('clients','edit') +
// filtro por team_id (nunca desativa cliente de outra equipe). Fecha a última escrita direta do browser.
export async function deactivateClientAction(clientId: string, reason: string | null): Promise<Res<{ endDate: string }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const endDate = todaySP()   // fim = hoje (Brasília), definido no servidor
  let q = supabase.from('clients').update({ status: 'inativo', end_date: endDate, end_reason: reason?.trim() || null }).eq('id', clientId)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true, endDate }
}

// Cria uma prateleira (nicho). Carimba team_id no servidor. Devolve a linha criada para o estado otimista.
export async function createNichoAction(input: { nome: string; cor: string | null; posicao: number }): Promise<Res<{ nicho: Record<string, unknown> }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const { data, error } = await supabase.from('nichos')
    .insert({ nome: input.nome, cor: input.cor, posicao: input.posicao, ativo: true, ...(teamId ? { team_id: teamId } : {}) })
    .select('*').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível criar a prateleira.' }
  return { ok: true, nicho: data as Record<string, unknown> }
}

// Atualiza uma prateleira (renomear, cor, ordem, ativar/desativar). Filtrado pela allowlist.
export async function updateNichoAction(id: string, patch: Record<string, unknown>): Promise<Res> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const clean = pickAllowed(patch, NICHO_COLS)
  if (Object.keys(clean).length === 0) return { ok: true }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('nichos').update(clean).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Upsert da integração (Z-API) de um cliente — 1 linha por cliente (UNIQUE client_id). Devolve a linha salva.
export async function upsertClientIntegrationAction(row: Record<string, unknown>): Promise<Res<{ integration: Record<string, unknown> }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createClient()
  const clean = pickAllowed(row, INTEG_COLS)
  const { data, error } = await supabase.from('client_integrations')
    .upsert(clean, { onConflict: 'client_id' }).select('*').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível salvar a integração.' }
  return { ok: true, integration: data as Record<string, unknown> }
}

// Excluir cliente (SOFT DELETE global, F4) — OWNER-ONLY (o RPC valida via require_owner). Usa a sessão do
// usuário (auth.uid()) → o RPC checa o papel. Cascata + reversível + auditável no banco; nada físico.
export async function softDeleteClientAction(clientId: string): Promise<Res> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: EXPIRED }
  const supabase = createClient()   // SESSÃO (auth.uid()) → soft_delete_client valida owner
  const { error } = await supabase.rpc('soft_delete_client', { p_client_id: clientId })
  if (error) return { ok: false, error: /owner/i.test(error.message) ? 'Apenas o owner da equipe pode excluir.' : error.message }
  return { ok: true }
}

// Cotação efetiva p/ lançar receita/comissão no servidor (MESMA leitura do /api/commission/auto).
async function resolveEditRate(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const auto = Number(fx?.cotacao_referencia) || manual || 5.40
  const r = resolveRate(fxc, auto)
  return r > 0 ? r : 5.40
}

// Campos do cliente que o SAVE com histórico pode gravar (identidade + cobrança/plano/datas/responsável).
// Money/datas entram aqui de propósito: é o cadastro histórico do cliente (gated por can('clients','edit') +
// ownership). NÃO é o updateClientAction (livre), que segue restrito à identidade.
const HISTORY_CLIENT_COLS = [
  'name', 'company', 'email', 'phone', 'nicho', 'fuso', 'city', 'state', 'area_code',
  'start_date', 'plano_id', 'plan_weekly', 'dia_pagamento_semana', 'periodicidade', 'forma_pagamento', 'assigned_to', 'assigned_name',
] as const

// SAVE com HISTÓRICO (CLIENT-HISTORY-ADMIN-003): grava os campos do cliente E reconstrói AUTOMATICAMENTE toda
// a jornada (lead/contato/reunião/proposta/fechamento + semanas/comissão/receita) nas DATAS HISTÓRICAS — sem
// botão separado. Reusa o motor (saveClientHistory → reconstructClientHistory). Segurança: service-role só após
// assertClientOwnership (mesmo modelo do reconstruct/payMonth). Sem start_date, só salva os campos (não reconstrói).
export async function saveClientHistoryAction(
  clientId: string,
  clientPatch: Record<string, unknown>,
  history: ClientHistoryInput,
): Promise<Res<{ reconstructed: boolean; leadId: string | null; createdLead: boolean; createdDeal: boolean; createdMeeting: boolean; stageEvents: number; marked: number[]; redated: number; hadDeal: boolean }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createServiceClient()
  const owned = await assertClientOwnership(supabase, clientId, g.context.activeTeamId)
  if (!owned.ok) return { ok: false, error: owned.status === 403 ? 'Cliente de outra equipe.' : 'Cliente não encontrado.' }
  const teamId = g.context.activeTeamId

  // 1) Grava os campos do cliente (allowlist) — nunca muta cliente de outra equipe (filtro por team_id).
  const clean = pickAllowed(clientPatch, HISTORY_CLIENT_COLS)
  if (Object.keys(clean).length > 0) {
    let q = supabase.from('clients').update(clean).eq('id', clientId)
    if (teamId) q = q.eq('team_id', teamId)
    const { error } = await q
    if (error) return { ok: false, error: error.message }
  }

  const emptyOut = { leadId: null, createdLead: false, createdDeal: false, createdMeeting: false, stageEvents: 0, marked: [] as number[], redated: 0, hadDeal: false }
  // 2) Sem data de início → só salvou os campos (não há o que reconstruir). Não é erro.
  if (!history.startDate) return { ok: true, reconstructed: false, ...emptyOut }

  // 3) Reconstrói o pipeline + o motor financeiro nas datas históricas.
  const stages = await getStages()
  const won = wonSlug(stages)
  const rate = await resolveEditRate(supabase)
  const r = await saveClientHistory(supabase as Parameters<typeof saveClientHistory>[0], clientId, history, won, rate, teamId)
  if (!r.ok) {
    const msg = r.reason === 'inativo' ? 'Cliente inativo — reative para reconstruir o histórico.'
      : r.reason === 'sem_inicio' ? 'Defina a data de início do contrato.'
      : 'Cliente não encontrado.'
    return { ok: false, error: msg }
  }
  return { ok: true, reconstructed: true, leadId: r.leadId, createdLead: r.createdLead, createdDeal: r.createdDeal, createdMeeting: r.createdMeeting, stageEvents: r.stageEvents, marked: r.marked, redated: r.redated, hadDeal: r.hadDeal }
}

// Pagamento MENSAL (F2): quita todas as semanas do mês de competência reusando o motor semanal (payMonth →
// payClientWeek). Sem monthRef, cobra o PRÓXIMO mês não pago. Mesma segurança do reconstruct (service-role só
// após assertClientOwnership). NÃO é 2º motor; a unidade continua a semana. Sem migration; sem mudar regra.
export async function payMonthAction(clientId: string, monthRef?: string): Promise<Res<{ marked: number[]; monthRef: string }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createServiceClient()
  const owned = await assertClientOwnership(supabase, clientId, g.context.activeTeamId)
  if (!owned.ok) return { ok: false, error: owned.status === 403 ? 'Cliente de outra equipe.' : 'Cliente não encontrado.' }
  const month = monthRef ?? (await nextUnpaidMonth(supabase as Parameters<typeof nextUnpaidMonth>[0], clientId))
  if (!month) return { ok: false, error: 'Defina a data de início antes de cobrar o mês.' }
  const rate = await resolveEditRate(supabase)
  const r = await payMonth(supabase as Parameters<typeof payMonth>[0], clientId, month, rate, g.context.activeTeamId)
  if (r.reason === 'inativo') return { ok: false, error: 'Cliente inativo — congelado.' }
  if (r.reason === 'sem_inicio') return { ok: false, error: 'Defina a data de início antes de cobrar o mês.' }
  return { ok: true, marked: r.marked, monthRef: r.monthRef }
}

// Upgrade de plano (F3): registra o evento + bônus (só a diferença, config do vendedor) na competência do
// upgrade e move o cliente para o novo plano. Reusa o motor vivo (applyPlanUpgrade). Mesma segurança do
// reconstruct/payMonth (service-role só após assertClientOwnership). Sem 2º motor; regra financeira explicada.
export async function registerPlanUpgradeAction(clientId: string, newPlanId: string, changedAt?: string): Promise<Res<{ bonus: number; deltaMensal: number }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createServiceClient()
  const owned = await assertClientOwnership(supabase, clientId, g.context.activeTeamId)
  if (!owned.ok) return { ok: false, error: owned.status === 403 ? 'Cliente de outra equipe.' : 'Cliente não encontrado.' }
  const changed = (changedAt && /^\d{4}-\d{2}-\d{2}$/.test(changedAt)) ? changedAt : new Date().toISOString().slice(0, 10)
  const rate = await resolveEditRate(supabase)
  const r = await applyPlanUpgrade(supabase as Parameters<typeof applyPlanUpgrade>[0], { clientId, newPlanId, changedAt: changed, rate, teamId: g.context.activeTeamId })
  if (!r.ok) {
    const msg = r.reason === 'mesmo_plano' ? 'Selecione um plano diferente do atual.'
      : r.reason === 'nao_e_upgrade' ? 'O novo plano precisa ser maior que o atual (upgrade).'
      : r.reason === 'inativo' ? 'Cliente inativo — reative antes de fazer upgrade.'
      : r.reason === 'plano_invalido' ? 'Plano inválido.'
      : 'Cliente não encontrado.'
    return { ok: false, error: msg }
  }
  return { ok: true, bonus: r.bonus, deltaMensal: r.deltaMensal }
}
