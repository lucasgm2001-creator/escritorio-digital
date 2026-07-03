'use server'

import { cookies } from 'next/headers'
import { createInvite, revokeInvite, leaveActiveTeam } from '@/server/services/TeamService'
import { getRequestContext } from '@/server/context/request-context'
import { ACTIVE_TEAM_COOKIE } from '@/lib/supabase/team'

// Cookie da equipe ativa — lido server-side por getActiveTeam. httpOnly (não precisa no client), 1 ano.
const TEAM_COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
}

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a acao.'
}

export async function createTeamInviteAction(): Promise<ActionResult<Awaited<ReturnType<typeof createInvite>>>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  try {
    const invite = await createInvite(context)
    return { ok: true, data: invite }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export async function revokeTeamInviteAction(inviteId: string): Promise<ActionResult<{ id: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  try {
    await revokeInvite(context, inviteId)
    return { ok: true, data: { id: inviteId } }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

// ── TEAM-SECURITY-001 ────────────────────────────────────────────────────────────────────────────────

// Trocar equipe ativa: valida no servidor que o usuário PERTENCE à equipe alvo (nunca confia no id vindo da
// UI) e só então persiste o cookie. getRequestContext passa a resolver a nova equipe no próximo request.
export async function switchTeamAction(teamId: string): Promise<ActionResult<{ teamId: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  const target = context.memberships.find(m => m.team_id === teamId)
  if (!target) return { ok: false, error: 'Voce nao faz parte dessa equipe.' }

  cookies().set(ACTIVE_TEAM_COOKIE, teamId, TEAM_COOKIE_OPTS)
  return { ok: true, data: { teamId } }
}

// Sair da equipe ativa: a regra crítica (sucessão/bloqueio) roda no TeamService. Aqui tratamos o cookie da
// equipe ativa e o destino: repontamos para outra equipe do usuário; se não houver nenhuma, limpamos o
// cookie e mandamos para /onboarding (a guarda de equipe faria isso de qualquer forma).
export async function leaveTeamAction(): Promise<ActionResult<{ message: string; redirectTo: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  let outcome
  try {
    outcome = await leaveActiveTeam(context)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }

  if (!outcome.ok) {
    const message =
      outcome.reason === 'sole-owner'
        ? 'Voce e o unico owner e unico membro desta equipe. Convide ou promova outra pessoa antes de sair.'
        : outcome.reason === 'not-member'
          ? 'Voce nao faz parte desta equipe.'
          : 'Nao ha equipe ativa para sair.'
    return { ok: false, error: message }
  }

  const remaining = context.memberships.filter(m => m.team_id !== outcome.leftTeamId)
  if (remaining.length > 0) {
    cookies().set(ACTIVE_TEAM_COOKIE, remaining[0].team_id, TEAM_COOKIE_OPTS)
  } else {
    cookies().delete(ACTIVE_TEAM_COOKIE)
  }

  const message = outcome.promotedName
    ? `Voce saiu da equipe. ${outcome.promotedName} foi promovido a owner.`
    : 'Voce saiu da equipe.'
  const redirectTo = remaining.length > 0 ? '/hall' : '/onboarding'
  return { ok: true, data: { message, redirectTo } }
}
