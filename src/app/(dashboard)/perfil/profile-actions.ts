'use server'

import { getRequestContext } from '@/server/context/request-context'
import { createClient } from '@/lib/supabase/server'

// Escrita do PRÓPRIO perfil (PERMISSIONS-005). NÃO depende de admin: qualquer usuário edita o seu perfil.
// SEGURANÇA: o id do perfil vem SEMPRE do contexto do servidor (context.user.id) — a UI NUNCA envia id/user_id,
// então é impossível editar o perfil de outro usuário, mesmo chamando a action manualmente. Allowlist de campos.
type WriteError = { message: string } | null

const PROFILE_COLS = ['name', 'phone', 'cargo', 'avatar_url'] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

export async function updateOwnProfileAction(patch: Record<string, unknown>): Promise<{ error: WriteError }> {
  const context = await getRequestContext()
  if (!context) return { error: { message: 'Sessão expirada. Entre novamente.' } }
  const clean = pick(patch, PROFILE_COLS)
  if (Object.keys(clean).length === 0) return { error: null }
  const supabase = createClient()
  const { error } = await supabase.from('profiles').update(clean).eq('id', context.user.id)   // sempre o próprio
  return { error: error ? { message: error.message } : null }
}
