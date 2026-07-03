import 'server-only'

import { requirePermission } from '@/lib/permissions/require-permission'
import { createServiceClient } from '@/lib/supabase/service'
import type { RequestContext } from '@/server/context/request-context'
import {
  createTeamInvite,
  getTeamInvites,
  getTeamMembers,
  revokeTeamInvite,
  type TeamInvite,
  type TeamMember,
} from '@/server/repositories/TeamRepository'

export class ActiveTeamRequiredError extends Error {
  readonly code = 'ACTIVE_TEAM_REQUIRED'

  constructor() {
    super('Active team is required')
    this.name = 'ActiveTeamRequiredError'
  }
}

function requireActiveTeamId(context: RequestContext): string {
  if (!context.activeTeamId) {
    throw new ActiveTeamRequiredError()
  }

  return context.activeTeamId
}

export async function getActiveTeamMembers(
  context: RequestContext,
): Promise<TeamMember[]> {
  const activeTeamId = requireActiveTeamId(context)

  return getTeamMembers(activeTeamId)
}

export async function getActiveTeamInvites(
  context: RequestContext,
): Promise<TeamInvite[]> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  return getTeamInvites(activeTeamId)
}

export async function createInvite(context: RequestContext): Promise<TeamInvite> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  return createTeamInvite(activeTeamId, context.user.id)
}

export async function revokeInvite(
  context: RequestContext,
  inviteId: string,
): Promise<void> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  await revokeTeamInvite(activeTeamId, inviteId)
}

// ── TEAM-SECURITY-001: sucessão de owner + saída segura ──────────────────────────────────────────────
// Hierarquia de sucessão quando o OWNER sai: outro owner mais antigo → admin mais antigo → member mais
// antigo. O schema (migration 039) só tem 'owner' | 'admin' | 'member' — NÃO existe 'manager', então esse
// nível da hierarquia pedida simplesmente não se aplica aqui. "Mais antigo" = menor created_at de
// team_members (a coluna existe); empate/nulo → id estável como desempate documentado.
const SUCCESSION_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 }

type LeaveMemberRow = { id: string; user_id: string; role: string; created_at: string | null }

// Pura + exportada (testável): escolhe o sucessor entre os OUTROS membros. null se não houver ninguém.
export function pickSuccessor(others: LeaveMemberRow[]): LeaveMemberRow | null {
  if (others.length === 0) return null
  return [...others].sort((a, b) => {
    const rank = (SUCCESSION_RANK[a.role] ?? 9) - (SUCCESSION_RANK[b.role] ?? 9)
    if (rank !== 0) return rank
    const ca = a.created_at ?? '9999-12-31T23:59:59Z'
    const cb = b.created_at ?? '9999-12-31T23:59:59Z'
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.id < b.id ? -1 : 1
  })[0]
}

export type LeaveTeamOutcome =
  | { ok: false; reason: 'no-active-team' | 'not-member' | 'sole-owner' }
  | { ok: true; promotedName: string | null; leftTeamId: string }

// Saída segura da equipe ATIVA — TODA a regra roda no servidor (Part 4), nunca na UI. As escritas usam o
// client de SERVICE ROLE (createServiceClient) porque o RLS de team_members só deixa admin apagar/alterar
// linhas: um member não conseguiria nem remover a PRÓPRIA membership. Revalidamos pelo banco antes de agir.
export async function leaveActiveTeam(context: RequestContext): Promise<LeaveTeamOutcome> {
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, reason: 'no-active-team' }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('team_members')
    .select('id, user_id, role, created_at')
    .eq('team_id', teamId)
  if (error) throw error

  const members = (data ?? []) as LeaveMemberRow[]
  const mine = members.find(m => m.user_id === context.user.id) ?? null
  if (!mine) return { ok: false, reason: 'not-member' }

  const others = members.filter(m => m.user_id !== context.user.id)

  // Não-owner (member/admin): sai direto — remove só a própria membership. Nenhum dado da equipe é apagado.
  if (mine.role !== 'owner') {
    const { error: delErr } = await svc.from('team_members').delete().eq('id', mine.id)
    if (delErr) throw delErr
    return { ok: true, promotedName: null, leftTeamId: teamId }
  }

  // Owner: só pode sair se existir OUTRO membro. Se for o único, bloqueia (nunca deixa equipe sem owner/vazia).
  const successor = pickSuccessor(others)
  if (!successor) return { ok: false, reason: 'sole-owner' }

  const { data: prof } = await svc.from('profiles').select('name').eq('id', successor.user_id).maybeSingle()
  const promotedName = (prof?.name as string | null) ?? null

  // ORDEM À PROVA DE FALHA — o novo owner é definido ANTES de remover o antigo. Em nenhum instante a equipe
  // fica sem owner: pior caso de falha parcial é ficar com 2 owners (recuperável), NUNCA 0. (Sem transação
  // no client JS; a atomicidade total via RPC está proposta em docs/team-owner-succession.md, não aplicada.)
  const { error: e1 } = await svc.from('team_members').update({ role: 'owner' }).eq('id', successor.id)
  if (e1) throw e1
  const { error: e2 } = await svc.from('teams').update({ owner_id: successor.user_id }).eq('id', teamId)
  if (e2) throw e2
  const { error: e3 } = await svc.from('team_members').delete().eq('id', mine.id)
  if (e3) throw e3

  return { ok: true, promotedName, leftTeamId: teamId }
}

// ── TEAM-ADMIN-001: gestão de membros (papéis, transferência, remoção) ───────────────────────────────
// TODA regra crítica roda AQUI (no servidor) — a UI só habilita/oculta botões. As escritas usam SERVICE
// ROLE porque o RLS de team_members só deixa admin alterar/remover, e queremos validar a regra de negócio
// (quem-pode-o-quê, owner único, sucessão) em código antes de tocar no banco. NENHUMA operação apaga dados
// operacionais (leads/clientes/financeiro): mexe SÓ em team_members / teams.owner_id.

export type MemberMgmtDeny =
  | 'no-active-team'
  | 'not-authorized'
  | 'target-not-found'
  | 'target-is-self'
  | 'target-is-owner'
  | 'last-owner'
  | 'invalid-role'

export type MemberMgmtOutcome = { ok: false; reason: MemberMgmtDeny } | { ok: true; memberName: string | null }

type RosterRow = { id: string; user_id: string; role: string; created_at: string | null }

async function loadRoster(svc: ReturnType<typeof createServiceClient>, teamId: string): Promise<RosterRow[]> {
  const { data, error } = await svc
    .from('team_members')
    .select('id, user_id, role, created_at')
    .eq('team_id', teamId)
  if (error) throw error
  return (data ?? []) as RosterRow[]
}

async function nameOf(svc: ReturnType<typeof createServiceClient>, userId: string): Promise<string | null> {
  const { data } = await svc.from('profiles').select('name, email').eq('id', userId).maybeSingle()
  return (data?.name as string | null) || (data?.email as string | null) || null
}

// Promover member→admin ou rebaixar admin→member. EXCLUSIVO do owner (Part 3: só o Owner promove/rebaixa
// admin). Nunca altera o owner por aqui — troca de dono é transferência de ownership. Idempotente.
export async function changeMemberRole(
  context: RequestContext,
  targetUserId: string,
  newRole: 'admin' | 'member',
): Promise<MemberMgmtOutcome> {
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, reason: 'no-active-team' }
  if (newRole !== 'admin' && newRole !== 'member') return { ok: false, reason: 'invalid-role' }
  if (context.role !== 'owner') return { ok: false, reason: 'not-authorized' }

  const svc = createServiceClient()
  const roster = await loadRoster(svc, teamId)
  const target = roster.find(m => m.user_id === targetUserId) ?? null
  if (!target) return { ok: false, reason: 'target-not-found' }
  if (target.user_id === context.user.id) return { ok: false, reason: 'target-is-self' }
  if (target.role === 'owner') return { ok: false, reason: 'target-is-owner' }

  const memberName = await nameOf(svc, target.user_id)
  if (target.role === newRole) return { ok: true, memberName }   // já está no papel pedido (idempotente)

  const { error } = await svc.from('team_members').update({ role: newRole }).eq('id', target.id)
  if (error) throw error
  return { ok: true, memberName }
}

// Transferir ownership para outro membro. EXCLUSIVO do owner (Part 4). Revalida no banco que quem chama é
// mesmo owner. Ordem À PROVA DE FALHA (espelha leaveActiveTeam): promove o novo owner ANTES de rebaixar o
// antigo → pior caso de falha parcial é 2 owners (recuperável), NUNCA 0. O owner antigo vira admin (a
// equipe continua com owner). Nada é apagado.
export async function transferOwnership(
  context: RequestContext,
  targetUserId: string,
): Promise<MemberMgmtOutcome> {
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, reason: 'no-active-team' }
  if (context.role !== 'owner') return { ok: false, reason: 'not-authorized' }

  const svc = createServiceClient()
  const roster = await loadRoster(svc, teamId)
  const mine = roster.find(m => m.user_id === context.user.id) ?? null
  if (!mine || mine.role !== 'owner') return { ok: false, reason: 'not-authorized' }   // revalida no banco
  const target = roster.find(m => m.user_id === targetUserId) ?? null
  if (!target) return { ok: false, reason: 'target-not-found' }
  if (target.user_id === context.user.id) return { ok: false, reason: 'target-is-self' }

  const memberName = await nameOf(svc, target.user_id)

  const { error: e1 } = await svc.from('team_members').update({ role: 'owner' }).eq('id', target.id)
  if (e1) throw e1
  const { error: e2 } = await svc.from('teams').update({ owner_id: target.user_id }).eq('id', teamId)
  if (e2) throw e2
  const { error: e3 } = await svc.from('team_members').update({ role: 'admin' }).eq('id', mine.id)
  if (e3) throw e3

  return { ok: true, memberName }
}

// Remover um membro da equipe. Owner remove member|admin; admin remove só member (conservador — Part 5). O
// owner NUNCA é removido por aqui (protege o último owner: para tirar um owner, transfira antes). Ninguém
// se remove por aqui (usar "Sair da equipe"). Apaga SÓ a linha de team_members do alvo — nenhum lead,
// cliente, dado financeiro ou operacional é tocado.
export async function removeMember(
  context: RequestContext,
  targetUserId: string,
): Promise<MemberMgmtOutcome> {
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, reason: 'no-active-team' }
  if (context.role !== 'owner' && context.role !== 'admin') return { ok: false, reason: 'not-authorized' }

  const svc = createServiceClient()
  const roster = await loadRoster(svc, teamId)
  const target = roster.find(m => m.user_id === targetUserId) ?? null
  if (!target) return { ok: false, reason: 'target-not-found' }
  if (target.user_id === context.user.id) return { ok: false, reason: 'target-is-self' }   // usar "Sair da equipe"
  if (target.role === 'owner') return { ok: false, reason: 'last-owner' }   // owner nunca é removido por aqui

  const allowed =
    (context.role === 'owner' && (target.role === 'member' || target.role === 'admin')) ||
    (context.role === 'admin' && target.role === 'member')
  if (!allowed) return { ok: false, reason: 'not-authorized' }

  const memberName = await nameOf(svc, target.user_id)
  const { error } = await svc.from('team_members').delete().eq('id', target.id)
  if (error) throw error
  return { ok: true, memberName }
}
