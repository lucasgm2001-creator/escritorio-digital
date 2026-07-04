'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

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
