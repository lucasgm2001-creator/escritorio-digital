'use server'

import { getRequestContext } from '@/server/context/request-context'
import { createClient } from '@/lib/supabase/server'
import { getMyCompensationMonth, type CompMonthDetail } from '@/server/services/MyCompensationService'

// Escrita do PRÓPRIO perfil (PERMISSIONS-005). NÃO depende de admin: qualquer usuário edita o seu perfil.
// SEGURANÇA: o id do perfil vem SEMPRE do contexto do servidor (context.user.id) — a UI NUNCA envia id/user_id,
// então é impossível editar o perfil de outro usuário, mesmo chamando a action manualmente. Allowlist de campos.
type WriteError = { message: string } | null

// Campos PESSOAIS do próprio perfil (inclui call_link, editado em Configurações). logo_url NÃO entra aqui
// (branding do workspace). 'cargo' TAMBÉM NÃO: o cargo é definido pela Administração (team_members.role_keys),
// nunca por texto livre no perfil (ACCESS-ROLES-001, Parte 2) — mesmo chamando a action, não passa a allowlist.
const PROFILE_COLS = ['name', 'phone', 'avatar_url', 'call_link'] as const

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

// Mês escolhido de "Minha Remuneração" (COMP-MESES-001). Só leitura e só do PRÓPRIO: o serviço resolve o
// seller por sellers.user_id = usuário logado, então não há parâmetro de identidade aqui para falsificar —
// o único argumento é a competência.
export async function getCompensationMonthAction(
  monthKey: string,
): Promise<{ ok: true; mes: CompMonthDetail } | { ok: false; error: string }> {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  const mes = await getMyCompensationMonth(context, monthKey)
  if (!mes) return { ok: false, error: 'Não foi possível carregar este mês.' }
  return { ok: true, mes }
}
