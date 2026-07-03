'use server'

import { cookies } from 'next/headers'
import {
  createInvite,
  revokeInvite,
  leaveActiveTeam,
  changeMemberRole,
  transferOwnership,
  removeMember,
  type MemberMgmtDeny,
} from '@/server/services/TeamService'
import { getRequestContext } from '@/server/context/request-context'
import { ACTIVE_TEAM_COOKIE } from '@/lib/supabase/team'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { MAX_TEAMS_PER_USER, hasReachedTeamLimit } from '@/lib/teams/limits'

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

// ── TEAM-SECURITY-002 ────────────────────────────────────────────────────────────────────────────────

// Resgatar convite estando JÁ em uma equipe (a causa do bloqueio do Gabriel era só a UI: o /onboarding
// redireciona quem já tem equipe, então não havia onde colar o código; o RPC redeem_invite sempre suportou
// múltiplas equipes). Aqui: pré-checa o convite via SERVICE ROLE (o RLS de team_invites é admin-only, o
// convidado não o lê — só LEITURA, nada gravado), aplica o LIMITE DE 4 EQUIPES no servidor, e resgata pelo
// client do USUÁRIO (redeem_invite usa auth.uid()). Idempotente e ADITIVO: não substitui/apaga a equipe
// anterior nem troca a equipe ativa.
export async function redeemInviteAction(token: string): Promise<ActionResult<{ teamId: string; message: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }
  const clean = token.trim()
  if (!clean) return { ok: false, error: 'Informe o codigo do convite.' }

  const svc = createServiceClient()
  const { data: inv } = await svc
    .from('team_invites')
    .select('team_id, expires_at, used_at')
    .eq('token', clean)
    .maybeSingle()
  if (!inv) return { ok: false, error: 'Convite invalido. Confira o codigo com quem convidou.' }
  if (inv.used_at) return { ok: false, error: 'Este convite ja foi utilizado.' }
  if (inv.expires_at && new Date(inv.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: 'Este convite expirou. Peca um novo a quem convidou.' }
  }

  const teamId = inv.team_id as string
  // Já é membro → apenas informa (Part 7). Não consome o convite, não duplica.
  if (context.memberships.some(m => m.team_id === teamId)) {
    return { ok: true, data: { teamId, message: 'Voce ja participa dessa equipe. Use o seletor para alterna-la.' } }
  }
  // Limite de equipes (fonte única em lib/teams/limits) — validado NO SERVIDOR.
  if (hasReachedTeamLimit(context.memberships.length)) {
    return { ok: false, error: `Voce ja participa do limite de ${MAX_TEAMS_PER_USER} equipes. Saia de uma equipe antes de entrar em outra.` }
  }

  // Resgate real: client do USUÁRIO (auth.uid() = o convidado). Insere a membership sem tocar nas demais.
  const supabase = createClient()
  const { error } = await supabase.rpc('redeem_invite', { p_token: clean })
  if (error) return { ok: false, error: errorMessage(error) }

  const { data: team } = await svc.from('teams').select('name').eq('id', teamId).maybeSingle()
  const teamName = (team?.name as string | null) ?? 'equipe'
  const count = context.memberships.length + 1
  return { ok: true, data: { teamId, message: `Voce entrou na equipe ${teamName}. Agora participa de ${count} ${count === 1 ? 'equipe' : 'equipes'}.` } }
}

// ── TEAM-ADMIN-001: gestão de membros ────────────────────────────────────────────────────────────────

// Traduz o motivo de recusa do servidor para a mensagem do usuário (Part 8). A autoridade é o SERVIDOR;
// aqui só traduzimos. "not-authorized" cobre o caso de a UI exibir um botão que o servidor recusa.
const MEMBER_MGMT_ERROR: Record<MemberMgmtDeny, string> = {
  'no-active-team': 'Nao ha equipe ativa.',
  'not-authorized': 'Voce nao tem permissao para alterar este membro.',
  'target-not-found': 'Membro nao encontrado nesta equipe.',
  'target-is-self': 'Use "Sair da equipe" para sair voce mesmo.',
  'target-is-owner': 'Use "Transferir ownership" para alterar o owner.',
  'last-owner': 'Nao e possivel remover o ultimo owner.',
  'invalid-role': 'Papel invalido.',
}

// Promover/rebaixar (member↔admin) — só o owner, validado no servidor. A UI recarrega via router.refresh.
export async function changeMemberRoleAction(
  targetUserId: string,
  newRole: 'admin' | 'member',
): Promise<ActionResult<{ message: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  let outcome
  try {
    outcome = await changeMemberRole(context, targetUserId, newRole)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
  if (!outcome.ok) return { ok: false, error: MEMBER_MGMT_ERROR[outcome.reason] }

  const message = newRole === 'admin' ? 'Membro promovido para admin.' : 'Membro rebaixado para member.'
  return { ok: true, data: { message } }
}

// Transferir ownership — só o owner (validado no servidor). Confirmação forte (digitar o nome) é na UI.
export async function transferOwnershipAction(targetUserId: string): Promise<ActionResult<{ message: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  let outcome
  try {
    outcome = await transferOwnership(context, targetUserId)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
  if (!outcome.ok) return { ok: false, error: MEMBER_MGMT_ERROR[outcome.reason] }

  return { ok: true, data: { message: 'Ownership transferida com sucesso.' } }
}

// Remover membro — owner/admin conforme a regra do servidor. Confirmação (nome do membro) é na UI.
export async function removeMemberAction(targetUserId: string): Promise<ActionResult<{ message: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  let outcome
  try {
    outcome = await removeMember(context, targetUserId)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
  if (!outcome.ok) return { ok: false, error: MEMBER_MGMT_ERROR[outcome.reason] }

  return { ok: true, data: { message: 'Membro removido da equipe.' } }
}
