'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escritas de VENDEDORES (config do Comercial — PERMISSIONS-004). Gerir vendedor é ação de ADMIN do módulo:
// exige commercial.manage (só o nível 'admin' concede 'manage' no modelo de níveis). Retorno no formato
// { data, error } — drop-in para o useSave/run e para os handlers diretos. team_id carimbado no servidor.
type WriteError = { message: string; code?: string } | null

const DENY: WriteError = { message: 'Você não tem acesso de administrador ao Comercial.' }
const EXPIRED: WriteError = { message: 'Sessão expirada. Entre novamente.' }

const SELLER_COLS = 'id, name, email, phone, photo_url, cargo, monthly_goal, default_commission, fixed_salary, start_date, observations, status, leads_assigned, conversion_rate, total_sales, created_at'
const SELLER_UPDATE_COLS = ['name', 'email', 'phone', 'cargo', 'monthly_goal', 'start_date', 'observations', 'status', 'photo_url'] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guardManage() {
  const context = await getRequestContext()
  if (!context) return { context: null, error: EXPIRED } as const
  if (!can(context, 'commercial', 'manage')) return { context: null, error: DENY } as const
  return { context, error: null } as const
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
  return { data: (data as Record<string, unknown>) ?? null, error: error ? { message: error.message } : null }
}

export async function updateSellerAction(id: string, patch: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const clean = pick(patch, SELLER_UPDATE_COLS)
  if (Object.keys(clean).length === 0) return { error: null }
  const supabase = createClient()
  const { error } = await supabase.from('sellers').update(clean).eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export async function deleteSellerAction(id: string): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('sellers').delete().eq('id', id)
  // Preserva o code (23503 = FK) para a mensagem amigável do handler.
  return { error: error ? { message: error.message, code: error.code } : null }
}
