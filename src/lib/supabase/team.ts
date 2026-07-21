import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { getMembershipsByUserId } from '@/server/repositories/TeamRepository'

export const ACTIVE_TEAM_COOKIE = 'edv2_active_team_id'

export type TeamRole = 'owner' | 'admin' | 'member'

export type TeamSummary = {
  id: string
  name: string
  owner_id: string | null
}

export type TeamMembership = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  roleKeys: string[]   // cargos (chaves do catálogo) — FONTE ÚNICA multi-cargo (ACCESS-ROLES-001)
  permissions: Record<string, unknown>
  created_at: string | null
  team: TeamSummary | null
}

export type ActiveTeamResult = {
  activeTeamId: string | null
  activeTeamName: string | null
  activeRole: TeamRole | null
  memberships: TeamMembership[]
}

export const getActiveTeam = cache(async (userId: string): Promise<ActiveTeamResult> => {
  if (!userId) {
    return { activeTeamId: null, activeTeamName: null, activeRole: null, memberships: [] }
  }

  const requestedTeamId = (await cookies()).get(ACTIVE_TEAM_COOKIE)?.value ?? null
  const memberships = await getMembershipsByUserId(userId)

  const activeMembership =
    memberships.find(membership => membership.team_id === requestedTeamId)
    ?? memberships[0]
    ?? null

  return {
    activeTeamId: activeMembership?.team_id ?? null,
    activeTeamName: activeMembership?.team?.name ?? null,
    activeRole: activeMembership?.role ?? null,
    memberships,
  }
})
