'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertClientOwnership } from '@/server/security/team-ownership'
import { reconstructClientHistory, payMonth, nextUnpaidMonth } from '@/lib/commission/actions'
import { resolveRate } from '@/lib/commission/calc'
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

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guardEdit() {
  const context = await getRequestContext()
  if (!context) return { context: null, error: EXPIRED } as const
  if (!can(context, 'clients', 'edit')) return { context: null, error: DENY } as const
  return { context, error: null } as const
}

// Atualiza dados do cliente (dossiê, pasta do Drive, identidade). Filtrado pela allowlist.
export async function updateClientAction(clientId: string, patch: Record<string, unknown>): Promise<Res> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const clean = pick(patch, CLIENT_COLS)
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
  const clean = pick(patch, NICHO_COLS)
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
  const clean = pick(row, INTEG_COLS)
  const { data, error } = await supabase.from('client_integrations')
    .upsert(clean, { onConflict: 'client_id' }).select('*').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Não foi possível salvar a integração.' }
  return { ok: true, integration: data as Record<string, unknown> }
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

// Reconstrução histórica do cliente (CLIENT-HISTORY-F1): a partir do start_date já gravado, coloca as
// semanas/comissão nas DATAS HISTÓRICAS reais (alinha o deal, re-data a semana carimbada "hoje", faz o
// backfill das vencidas) reusando o motor existente (reconstructClientHistory → payDueWeeks/payWeek/calc).
// Sem migration, sem motor novo, sem mudar regra de dinheiro. Segurança: service-role só APÓS confirmar que
// o cliente é da EQUIPE ATIVA (assertClientOwnership) — MESMO modelo do /api/commission/auto (P1-SERVICEROLE-001).
export async function reconstructClientHistoryAction(clientId: string): Promise<Res<{ marked: number[]; redated: number; dueCount: number; hadDeal: boolean }>> {
  const g = await guardEdit()
  if (!g.context) return { ok: false, error: g.error }
  const supabase = createServiceClient()
  const owned = await assertClientOwnership(supabase, clientId, g.context.activeTeamId)
  if (!owned.ok) return { ok: false, error: owned.status === 403 ? 'Cliente de outra equipe.' : 'Cliente não encontrado.' }
  const rate = await resolveEditRate(supabase)
  const r = await reconstructClientHistory(supabase as Parameters<typeof reconstructClientHistory>[0], clientId, rate, g.context.activeTeamId)
  if (!r.ok) {
    const msg = r.reason === 'inativo' ? 'Cliente inativo — congelado (reative para reconstruir).'
      : r.reason === 'sem_inicio' ? 'Defina a data de início do contrato antes de reconstruir.'
      : 'Cliente não encontrado.'
    return { ok: false, error: msg }
  }
  return { ok: true, marked: r.marked, redated: r.redated, dueCount: r.dueCount, hadDeal: r.hadDeal }
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
