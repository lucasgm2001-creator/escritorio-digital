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
