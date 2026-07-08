'use server'

import { createClient } from '@/lib/supabase/server'
import { pickAllowed, requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'

// Escritas de VENDEDORES (config do Comercial — PERMISSIONS-004). Gerir vendedor é ação de ADMIN do módulo:
// exige commercial.manage (só o nível 'admin' concede 'manage' no modelo de níveis). Retorno no formato
// { data, error } — drop-in para o useSave/run e para os handlers diretos. team_id carimbado no servidor.
type WriteError = ActionError

const DENY = 'Você não tem acesso de administrador ao Comercial.'

const SELLER_COLS = 'id, name, email, phone, photo_url, cargo, monthly_goal, default_commission, fixed_salary, start_date, observations, status, leads_assigned, conversion_rate, total_sales, created_at'
const SELLER_UPDATE_COLS = ['name', 'email', 'phone', 'cargo', 'monthly_goal', 'start_date', 'observations', 'status', 'photo_url'] as const

async function guardManage() {
  return requireActionContext({
    permission: { module: 'commercial', action: 'manage' },
    deniedMessage: DENY,
  })
}

export async function createSellerAction(input: {
  name: string; email: string | null; phone: string | null; cargo: string | null; monthly_goal: number
}): Promise<{ data: Record<string, unknown> | null; error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { data: null, error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  // Defaults de negócio (zerados) definidos no SERVIDOR — não vêm da UI.
  const { data, error } = await supabase.from('sellers').insert({
    name: input.name, email: input.email, phone: input.phone, cargo: input.cargo, monthly_goal: input.monthly_goal,
    status: 'ativo', total_sales: 0, total_commissions: 0, leads_assigned: 0, conversion_rate: 0,
    ...(teamId ? { team_id: teamId } : {}),
  }).select(SELLER_COLS).single()
  return { data: (data as Record<string, unknown>) ?? null, error: toActionError(error) }
}

export async function updateSellerAction(id: string, patch: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const clean = pickAllowed(patch, SELLER_UPDATE_COLS)
  if (Object.keys(clean).length === 0) return { error: null }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  // Defense-in-depth (SECURITY-ACTIONS-001): filtra por team_id no servidor — nunca muta vendedor de outra equipe.
  let q = supabase.from('sellers').update(clean).eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

export async function deleteSellerAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('sellers').delete().eq('id', id)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  // Preserva o code (23503 = FK) para a mensagem amigável do handler.
  return { error: toActionError(error) }
}
